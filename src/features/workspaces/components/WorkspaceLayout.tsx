import { PointerActivationConstraints } from "@dnd-kit/dom";
import {
	DragDropProvider,
	KeyboardSensor,
	PointerSensor,
} from "@dnd-kit/react";
import { useQueryClient } from "@tanstack/react-query";
import {
	type ReactElement,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "#/components/ui/resizable";
import {
	applyWorkspaceItemDeletionInCaches,
	applyWorkspaceItemMoveInCaches,
	applyWorkspaceItemReorderInCaches,
	upsertWorkspaceItemInCaches,
	workspaceItemsQueryKey,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import AiChatPanel from "#/features/workspaces/components/AiChatPanel";
import WorkspaceContent from "#/features/workspaces/components/WorkspaceContent";
import WorkspaceContextBar from "#/features/workspaces/components/WorkspaceContextBar";
import {
	WorkspaceSkeletonAiChatPanel,
	WorkspaceSkeletonChrome,
	WorkspaceSkeletonContent,
} from "#/features/workspaces/components/WorkspacePageSkeleton";
import WorkspaceTopBar from "#/features/workspaces/components/WorkspaceTopBar";
import type {
	ReorderWorkspaceItemsInput,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import {
	getWorkspaceDragIntent,
	shouldPreventWorkspaceItemOptimisticSorting,
	shouldPreventWorkspacePointerActivation,
} from "#/features/workspaces/model/drag";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { useWorkspaceNavigation } from "#/features/workspaces/navigation/useWorkspaceNavigation";
import type { WorkspaceRealtimeEvent } from "#/features/workspaces/realtime/messages";
import { useWorkspaceRealtime } from "#/features/workspaces/realtime/use-workspace-presence";
import { useWorkspacePersistedStoresHydrated } from "#/features/workspaces/state/persisted-store-hydration";
import {
	useWorkspaceUiStore,
	type WorkspacePane,
	type WorkspacePresentation,
} from "#/features/workspaces/state/workspace-ui-store";
import {
	createWorkspaceItemMutationInput,
	useCreateWorkspaceItemMutation,
} from "#/features/workspaces/use-create-workspace-item";
import { useMoveWorkspaceItemMutation } from "#/features/workspaces/use-move-workspace-item";
import { useReorderWorkspaceItemsMutation } from "#/features/workspaces/use-reorder-workspace-items";
import {
	arraysEqual,
	getWorkspaceItemRowOrders,
	mergeWorkspaceItemOrder,
	WORKSPACE_ITEM_SORT_ORDER_STEP,
} from "#/features/workspaces/workspace-item-ordering";
import { useAppHotkey } from "#/lib/hotkeys-core";

export type { WorkspaceItem } from "#/features/workspaces/model/types";

const workspaceDragSensors = [
	PointerSensor.configure({
		activationConstraints(event) {
			if (event.pointerType === "touch") {
				return [
					new PointerActivationConstraints.Delay({
						value: 250,
						tolerance: 5,
					}),
				];
			}

			return [new PointerActivationConstraints.Distance({ value: 6 })];
		},
		preventActivation(event, source) {
			return shouldPreventWorkspacePointerActivation(event, source);
		},
	}),
	KeyboardSensor,
];
const WORKSPACE_ITEM_REORDER_SAVE_DEBOUNCE_MS = 450;

interface WorkspaceShellProps {
	workspace: WorkspaceSummary;
	items: WorkspaceItem[];
	activeTabIdFromUrl?: string;
	activeViewFromUrl?: string;
}

interface WorkspaceFrameProps {
	chrome: ReactNode;
	content: ReactNode;
	chatPanel?: ReactElement;
}

export function WorkspaceShell({
	workspace,
	items,
	activeTabIdFromUrl,
	activeViewFromUrl,
}: WorkspaceShellProps) {
	const queryClient = useQueryClient();
	const createWorkspaceItemMutation = useCreateWorkspaceItemMutation();
	const reorderWorkspaceItemsMutation = useReorderWorkspaceItemsMutation();
	const moveWorkspaceItemMutation = useMoveWorkspaceItemMutation();
	const shouldIgnoreWorkspaceItemReorderEvent =
		reorderWorkspaceItemsMutation.shouldIgnoreReorderEvent;
	const shouldIgnoreWorkspaceItemMoveEvent =
		moveWorkspaceItemMutation.shouldIgnoreMoveEvent;
	const persistedStoresHydrated = useWorkspacePersistedStoresHydrated();
	const workspaceItemOrderRef = useRef(new Map<string, string[]>());
	const reorderSaveTimers = useRef(
		new Map<string, ReturnType<typeof setTimeout>>(),
	);
	const pendingReorderInputs = useRef(
		new Map<string, ReorderWorkspaceItemsInput>(),
	);
	const [workspaceItemOrderOverrides, setWorkspaceItemOrderOverrides] =
		useState(() => new Map<string, string[]>());
	const ensureWorkspaceUiSession = useWorkspaceUiStore(
		(state) => state.ensureWorkspaceSession,
	);
	const toggleChatPanelCollapsed = useWorkspaceUiStore(
		(state) => state.toggleChatPanelCollapsed,
	);
	const handleWorkspaceRealtimeEvent = useCallback(
		(event: WorkspaceRealtimeEvent) => {
			if (event.workspaceId !== workspace.id) {
				return;
			}

			if (event.type === "workspace.item.deleted") {
				applyWorkspaceItemDeletionInCaches(queryClient, {
					workspaceId: event.workspaceId,
					deletedItemIds: event.payload.deletedItemIds,
					reparentedItems: event.payload.reparentedItems,
				});
				return;
			}

			if (event.type === "workspace.items.reordered") {
				if (shouldIgnoreWorkspaceItemReorderEvent(event.payload)) {
					return;
				}

				applyWorkspaceItemReorderInCaches(queryClient, {
					workspaceId: event.workspaceId,
					parentId: event.payload.parentId,
					row: event.payload.row,
					items: event.payload.items,
				});
				return;
			}

			if (event.type === "workspace.item.moved") {
				if (shouldIgnoreWorkspaceItemMoveEvent(event.payload)) {
					return;
				}

				applyWorkspaceItemMoveInCaches(queryClient, {
					workspaceId: event.workspaceId,
					item: event.payload.item,
					source: event.payload.source,
					destination: event.payload.destination,
					clientMutationId: event.payload.clientMutationId,
				});
				return;
			}

			upsertWorkspaceItemInCaches(queryClient, event.payload.item);
		},
		[
			queryClient,
			shouldIgnoreWorkspaceItemMoveEvent,
			shouldIgnoreWorkspaceItemReorderEvent,
			workspace.id,
		],
	);
	const realtime = useWorkspaceRealtime({
		workspaceId: workspace.id,
		onEvent: handleWorkspaceRealtimeEvent,
		onReconnect: () => {
			queryClient.invalidateQueries({
				queryKey: workspaceItemsQueryKey(workspace.id),
			});
			queryClient.invalidateQueries({
				queryKey: workspacePageQueryKey(workspace.id),
			});
		},
	});
	const {
		activeItem,
		activeTab,
		activateWorkspaceTab,
		closeCurrentView,
		closeWorkspaceTab,
		createWorkspaceTab,
		dispatchWorkspaceDragCommand,
		itemsById,
		openItem,
		openItemInNewTab,
		openWorkspaceRoot,
		scopedItems,
		session,
	} = useWorkspaceNavigation({
		workspace,
		items,
		activeTabIdFromUrl,
		activeViewFromUrl,
	});
	const validItemIds = useMemo(() => new Set(itemsById.keys()), [itemsById]);
	const uiSession = useWorkspaceUiStore(
		(state) => state.sessionsByWorkspaceId[workspace.id],
	);
	const normalizedUiSession = useMemo(
		() =>
			uiSession ?? {
				chatPanelCollapsed: false,
				presentation: { mode: "standard" } as WorkspacePresentation,
			},
		[uiSession],
	);
	const { chatPanelCollapsed, presentation } = normalizedUiSession;
	const presentationHasChat = hasPaneKind(presentation, "chat");
	const orderedScopedItems = useMemo(
		() =>
			applyWorkspaceItemOrderOverrides({
				items: scopedItems,
				orderOverrides: workspaceItemOrderOverrides,
				workspaceId: workspace.id,
			}),
		[scopedItems, workspace.id, workspaceItemOrderOverrides],
	);

	useEffect(() => {
		ensureWorkspaceUiSession({
			workspaceId: workspace.id,
			validItemIds,
		});
	}, [ensureWorkspaceUiSession, validItemIds, workspace.id]);
	useAppHotkey("workspace.aiChat.toggle", () => {
		toggleChatPanelCollapsed(workspace.id);
	});

	useEffect(() => {
		setWorkspaceItemOrderOverrides((current) =>
			reconcileWorkspaceItemOrderOverrides({
				items: scopedItems,
				orderOverrides: current,
				workspaceId: workspace.id,
			}),
		);
	}, [scopedItems, workspace.id]);

	useEffect(() => {
		syncWorkspaceItemOrderRef({
			items: orderedScopedItems,
			orderRef: workspaceItemOrderRef.current,
			workspaceId: workspace.id,
		});
	}, [orderedScopedItems, workspace.id]);

	useEffect(
		() => () => {
			for (const timer of reorderSaveTimers.current.values()) {
				clearTimeout(timer);
			}
		},
		[],
	);

	const clearWorkspaceItemOrderOverride = useCallback(
		(input: { orderScopeKey: string; orderedItemIds: string[] }) => {
			setWorkspaceItemOrderOverrides((current) => {
				const currentOrder = current.get(input.orderScopeKey);

				if (!currentOrder || !arraysEqual(currentOrder, input.orderedItemIds)) {
					return current;
				}

				const next = new Map(current);
				next.delete(input.orderScopeKey);
				return next;
			});
			workspaceItemOrderRef.current.delete(input.orderScopeKey);
		},
		[],
	);

	const cancelWorkspaceItemReorderSave = useCallback(
		(input: { orderScopeKey: string }) => {
			const existingTimer = reorderSaveTimers.current.get(input.orderScopeKey);

			if (existingTimer) {
				clearTimeout(existingTimer);
			}

			reorderSaveTimers.current.delete(input.orderScopeKey);
			pendingReorderInputs.current.delete(input.orderScopeKey);
			workspaceItemOrderRef.current.delete(input.orderScopeKey);
			setWorkspaceItemOrderOverrides((current) => {
				if (!current.has(input.orderScopeKey)) {
					return current;
				}

				const next = new Map(current);
				next.delete(input.orderScopeKey);
				return next;
			});
		},
		[],
	);

	const scheduleWorkspaceItemReorderSave = useCallback(
		(input: {
			orderScopeKey: string;
			mutationInput: ReorderWorkspaceItemsInput;
		}) => {
			const existingTimer = reorderSaveTimers.current.get(input.orderScopeKey);

			if (existingTimer) {
				clearTimeout(existingTimer);
			}

			pendingReorderInputs.current.set(
				input.orderScopeKey,
				input.mutationInput,
			);

			const timer = setTimeout(() => {
				const latestInput = pendingReorderInputs.current.get(
					input.orderScopeKey,
				);

				reorderSaveTimers.current.delete(input.orderScopeKey);
				pendingReorderInputs.current.delete(input.orderScopeKey);

				if (!latestInput) {
					return;
				}

				reorderWorkspaceItemsMutation.mutate(latestInput, {
					onError: () => {
						clearWorkspaceItemOrderOverride({
							orderScopeKey: input.orderScopeKey,
							orderedItemIds: latestInput.orderedItemIds,
						});
					},
					onSuccess: (result) => {
						clearWorkspaceItemOrderOverride({
							orderScopeKey: input.orderScopeKey,
							orderedItemIds: result.items.map((item) => item.id),
						});
					},
				});
			}, WORKSPACE_ITEM_REORDER_SAVE_DEBOUNCE_MS);

			reorderSaveTimers.current.set(input.orderScopeKey, timer);
		},
		[clearWorkspaceItemOrderOverride, reorderWorkspaceItemsMutation],
	);

	if (!persistedStoresHydrated || !session || !activeTab) {
		return (
			<WorkspaceFrame
				chrome={<WorkspaceSkeletonChrome />}
				content={<WorkspaceSkeletonContent />}
				chatPanel={<WorkspaceSkeletonAiChatPanel />}
			/>
		);
	}

	if (presentation.mode === "maximized") {
		return (
			<MaximizedWorkspaceSurface>
				<WorkspacePaneRenderer
					workspaceId={workspace.id}
					pane={presentation.pane}
					itemsById={itemsById}
					scopedItems={orderedScopedItems}
					onOpenItem={openItem}
				/>
			</MaximizedWorkspaceSurface>
		);
	}

	return (
		<DragDropProvider
			sensors={workspaceDragSensors}
			onDragOver={(event) => {
				if (shouldPreventWorkspaceItemOptimisticSorting(event)) {
					event.preventDefault();
				}
			}}
			onDragEnd={(event) => {
				const intent = getWorkspaceDragIntent({
					event,
					items: orderedScopedItems,
					orderRef: workspaceItemOrderRef.current,
					workspaceId: workspace.id,
				});

				if (intent) {
					switch (intent.kind) {
						case "move-tab-in-strip":
							dispatchWorkspaceDragCommand({
								type: "move-tab-in-strip",
								tabId: intent.tabId,
								toIndex: intent.toIndex,
							});
							return;
						case "reorder-tabs-over-tab":
							dispatchWorkspaceDragCommand({
								type: "reorder-tabs-over-tab",
								activeTabId: intent.activeTabId,
								overTabId: intent.overTabId,
							});
							return;
						case "open-item-tab":
							openItemInNewTab(intent);
							return;
						case "move-item-blocked":
							return;
						case "move-item":
							cancelWorkspaceItemReorderSave({
								orderScopeKey: intent.resolution.sourceOrderScopeKey,
							});
							moveWorkspaceItemMutation.mutate(intent.resolution.mutationInput);
							return;
						case "reorder-item":
							workspaceItemOrderRef.current.set(
								intent.orderScopeKey,
								intent.mutationInput.orderedItemIds,
							);
							setWorkspaceItemOrderOverrides((current) => {
								const next = new Map(current);
								next.set(
									intent.orderScopeKey,
									intent.mutationInput.orderedItemIds,
								);
								return next;
							});
							scheduleWorkspaceItemReorderSave({
								orderScopeKey: intent.orderScopeKey,
								mutationInput: intent.mutationInput,
							});
							return;
					}
				}
			}}
		>
			<WorkspaceFrame
				chrome={
					<WorkspaceTopBar
						workspace={workspace}
						itemsById={itemsById}
						tabs={session.tabs}
						activeTab={activeTab}
						contextBar={
							<WorkspaceContextBar
								workspace={workspace}
								activeItem={activeItem}
								itemsById={itemsById}
								onCloseCurrentView={closeCurrentView}
								onNavigateToRoot={openWorkspaceRoot}
								onNavigateToItem={openItem}
								onCreateItem={(input) => {
									createWorkspaceItemMutation.mutate(
										createWorkspaceItemMutationInput({
											workspaceId: workspace.id,
											type: input.type,
											parentId: input.parentId,
											existingItems: orderedScopedItems,
										}),
									);
								}}
							/>
						}
						presence={realtime}
						onActivateTab={activateWorkspaceTab}
						onCloseTab={closeWorkspaceTab}
						onCreateRootTab={createWorkspaceTab}
					/>
				}
				content={
					presentation.mode === "split" ? (
						<WorkspaceSplitPresentation
							workspaceId={workspace.id}
							panes={presentation.panes}
							direction={presentation.direction}
							itemsById={itemsById}
							scopedItems={orderedScopedItems}
							onOpenItem={openItem}
						/>
					) : (
						<WorkspaceContent
							items={orderedScopedItems}
							activeItem={activeItem}
							onOpenItem={openItem}
						/>
					)
				}
				chatPanel={
					chatPanelCollapsed || presentationHasChat ? undefined : (
						<AiChatPanel workspaceId={workspace.id} />
					)
				}
			/>
		</DragDropProvider>
	);
}

function syncWorkspaceItemOrderRef(input: {
	items: WorkspaceItem[];
	orderRef: Map<string, string[]>;
	workspaceId: string;
}) {
	const nextOrders = getWorkspaceItemRowOrders(input.items, input.workspaceId);

	for (const key of input.orderRef.keys()) {
		if (!nextOrders.has(key)) {
			input.orderRef.delete(key);
		}
	}

	for (const [key, itemIds] of nextOrders) {
		input.orderRef.set(key, itemIds);
	}
}

function applyWorkspaceItemOrderOverrides(input: {
	items: WorkspaceItem[];
	orderOverrides: Map<string, string[]>;
	workspaceId: string;
}) {
	if (input.orderOverrides.size === 0) {
		return input.items;
	}

	const rowOrders = getWorkspaceItemRowOrders(input.items, input.workspaceId);
	const itemsById = new Map(input.items.map((item) => [item.id, item]));
	const updatedItemsById = new Map<string, WorkspaceItem>();

	for (const [orderScopeKey, currentItemIds] of rowOrders) {
		const overrideItemIds = input.orderOverrides.get(orderScopeKey);

		if (!overrideItemIds) {
			continue;
		}

		const orderedItemIds = mergeWorkspaceItemOrder(
			overrideItemIds,
			currentItemIds,
		);

		for (const [index, itemId] of orderedItemIds.entries()) {
			const item = itemsById.get(itemId);

			if (!item) {
				continue;
			}

			updatedItemsById.set(itemId, {
				...item,
				sortOrder: (index + 1) * WORKSPACE_ITEM_SORT_ORDER_STEP,
			});
		}
	}

	if (updatedItemsById.size === 0) {
		return input.items;
	}

	return input.items.map((item) => updatedItemsById.get(item.id) ?? item);
}

function reconcileWorkspaceItemOrderOverrides(input: {
	items: WorkspaceItem[];
	orderOverrides: Map<string, string[]>;
	workspaceId: string;
}) {
	if (input.orderOverrides.size === 0) {
		return input.orderOverrides;
	}

	const rowOrders = getWorkspaceItemRowOrders(input.items, input.workspaceId);
	let next = input.orderOverrides;

	for (const [orderScopeKey, overrideItemIds] of input.orderOverrides) {
		const currentItemIds = rowOrders.get(orderScopeKey);

		if (!currentItemIds) {
			if (next === input.orderOverrides) {
				next = new Map(input.orderOverrides);
			}

			next.delete(orderScopeKey);
			continue;
		}

		const reconciledItemIds = mergeWorkspaceItemOrder(
			overrideItemIds,
			currentItemIds,
		);

		if (arraysEqual(reconciledItemIds, currentItemIds)) {
			if (next === input.orderOverrides) {
				next = new Map(input.orderOverrides);
			}

			next.delete(orderScopeKey);
			continue;
		}

		if (!arraysEqual(reconciledItemIds, overrideItemIds)) {
			if (next === input.orderOverrides) {
				next = new Map(input.orderOverrides);
			}

			next.set(orderScopeKey, reconciledItemIds);
		}
	}

	return next;
}

export function WorkspaceFrame({
	chrome,
	content,
	chatPanel,
}: WorkspaceFrameProps) {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<ResizablePanelGroup
				id="workspace-layout"
				orientation="horizontal"
				className="min-h-screen"
				resizeTargetMinimumSize={{ coarse: 37, fine: 27 }}
			>
				<ResizablePanel id="workspace" minSize="45%">
					<div className="min-h-screen min-w-0">
						{chrome}
						<main className="bg-background">{content}</main>
					</div>
				</ResizablePanel>

				{chatPanel ? (
					<>
						<ResizableHandle
							id="workspace-ai-chat-separator"
							className="relative z-[45] -mx-[13px] flex w-[27px] items-stretch justify-center bg-transparent outline-none after:hidden [&[data-separator=active]>div]:w-[3px] [&[data-separator=active]>div]:bg-ring [&[data-separator=hover]>div]:w-[3px] [&[data-separator=hover]>div]:bg-ring/70"
							onPointerUp={(event) => event.currentTarget.blur()}
						>
							<div className="my-0 w-px bg-border transition-[background-color,width] duration-150" />
						</ResizableHandle>
						<ResizablePanel
							id="ai-chat"
							defaultSize="30rem"
							minSize="26rem"
							maxSize="60%"
						>
							{chatPanel}
						</ResizablePanel>
					</>
				) : null}
			</ResizablePanelGroup>
		</div>
	);
}

function MaximizedWorkspaceSurface({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-screen bg-background text-foreground">{children}</div>
	);
}

function WorkspacePaneRenderer({
	workspaceId,
	pane,
	itemsById,
	scopedItems,
	onOpenItem,
}: {
	workspaceId: string;
	pane: WorkspacePane;
	itemsById: Map<string, WorkspaceItem>;
	scopedItems: WorkspaceItem[];
	onOpenItem: (item: WorkspaceItem, options?: { background?: boolean }) => void;
}) {
	switch (pane.kind) {
		case "chat":
			return <AiChatPanel workspaceId={workspaceId} />;
		case "item": {
			const item = itemsById.get(pane.itemId);

			return (
				<WorkspaceContent
					items={scopedItems}
					activeItem={item}
					onOpenItem={onOpenItem}
				/>
			);
		}
		case "root":
			return (
				<WorkspaceContent
					items={scopedItems}
					activeItem={undefined}
					onOpenItem={onOpenItem}
				/>
			);
	}
}

function WorkspaceSplitPresentation({
	workspaceId,
	panes,
	direction,
	itemsById,
	scopedItems,
	onOpenItem,
}: {
	workspaceId: string;
	panes: [WorkspacePane, WorkspacePane];
	direction: "horizontal" | "vertical";
	itemsById: Map<string, WorkspaceItem>;
	scopedItems: WorkspaceItem[];
	onOpenItem: (item: WorkspaceItem, options?: { background?: boolean }) => void;
}) {
	return (
		<ResizablePanelGroup
			id="workspace-split-presentation"
			orientation={direction}
			className="min-h-[calc(100vh-5.75rem)]"
		>
			<ResizablePanel id={panes[0].id} minSize="18rem">
				<WorkspacePaneRenderer
					workspaceId={workspaceId}
					pane={panes[0]}
					itemsById={itemsById}
					scopedItems={scopedItems}
					onOpenItem={onOpenItem}
				/>
			</ResizablePanel>
			<ResizableHandle withHandle={true} />
			<ResizablePanel id={panes[1].id} minSize="18rem">
				<WorkspacePaneRenderer
					workspaceId={workspaceId}
					pane={panes[1]}
					itemsById={itemsById}
					scopedItems={scopedItems}
					onOpenItem={onOpenItem}
				/>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}

function hasPaneKind(
	presentation: WorkspacePresentation,
	kind: WorkspacePane["kind"],
) {
	if (presentation.mode === "standard") {
		return false;
	}

	if (presentation.mode === "maximized") {
		return presentation.pane.kind === kind;
	}

	return presentation.panes.some((pane) => pane.kind === kind);
}
