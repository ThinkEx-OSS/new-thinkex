import { PointerActivationConstraints } from "@dnd-kit/dom";
import {
	DragDropProvider,
	KeyboardSensor,
	PointerSensor,
} from "@dnd-kit/react";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactElement, type ReactNode, useEffect, useMemo } from "react";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "#/components/ui/resizable";
import {
	applyWorkspaceEventToCache,
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
	WorkspaceItemType,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import {
	getWorkspaceDragCommand,
	getWorkspaceItemMoveInput,
	getWorkspaceItemTabInsertInput,
	shouldPreventWorkspacePointerActivation,
} from "#/features/workspaces/model/drag";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { isWorkspaceItemView } from "#/features/workspaces/model/view";
import { useWorkspaceNavigation } from "#/features/workspaces/navigation/useWorkspaceNavigation";
import { useWorkspaceRealtime } from "#/features/workspaces/realtime/use-workspace-presence";
import { useWorkspacePersistedStoresHydrated } from "#/features/workspaces/state/persisted-store-hydration";
import {
	useWorkspaceUiStore,
	type WorkspacePane,
	type WorkspacePresentation,
} from "#/features/workspaces/state/workspace-ui-store";
import { shouldIgnoreWorkspaceClientMutationEcho } from "#/features/workspaces/use-workspace-client-mutation-echo";
import {
	useCreateWorkspaceItemMutation,
	useMoveWorkspaceItemMutation,
} from "#/features/workspaces/use-workspace-kernel-items";
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

interface WorkspaceShellProps {
	workspace: WorkspaceSummary;
	items: WorkspaceItem[];
	revision: number;
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
	revision,
	activeTabIdFromUrl,
	activeViewFromUrl,
}: WorkspaceShellProps) {
	const queryClient = useQueryClient();
	const createWorkspaceItemMutation = useCreateWorkspaceItemMutation();
	const moveWorkspaceItemMutation = useMoveWorkspaceItemMutation();
	const persistedStoresHydrated = useWorkspacePersistedStoresHydrated();
	const ensureWorkspaceUiSession = useWorkspaceUiStore(
		(state) => state.ensureWorkspaceSession,
	);
	const toggleChatPanelCollapsed = useWorkspaceUiStore(
		(state) => state.toggleChatPanelCollapsed,
	);
	const realtime = useWorkspaceRealtime({
		workspaceId: workspace.id,
		lastSeenRevision: revision,
		onEvent: (event) => {
			if (shouldIgnoreWorkspaceClientMutationEcho(event)) {
				return;
			}
			applyWorkspaceEventToCache(queryClient, event);
		},
		onReconnect: () => {
			queryClient.invalidateQueries({
				queryKey: workspacePageQueryKey(workspace.id),
			});
		},
		onRevisionGap: () => {
			queryClient.invalidateQueries({
				queryKey: workspacePageQueryKey(workspace.id),
			});
		},
	});
	const {
		activeItem,
		activeTab,
		activateWorkspaceTab,
		closeItemView,
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
	const orderedScopedItems = scopedItems;
	const createWorkspaceItem = (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => {
		createWorkspaceItemMutation.mutate(
			{
				id: crypto.randomUUID(),
				workspaceId: workspace.id,
				parentId: input.parentId,
				type: input.type,
			},
			{
				onSuccess: (command) => openItem(command.result),
			},
		);
	};

	useEffect(() => {
		ensureWorkspaceUiSession({
			workspaceId: workspace.id,
			validItemIds,
		});
	}, [ensureWorkspaceUiSession, validItemIds, workspace.id]);
	useAppHotkey("workspace.aiChat.toggle", () => {
		toggleChatPanelCollapsed(workspace.id);
	});

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
			onDragEnd={(event) => {
				const command = getWorkspaceDragCommand(event);

				if (command?.type === "move-tab-in-strip") {
					dispatchWorkspaceDragCommand({
						type: "move-tab-in-strip",
						tabId: command.tabId,
						toIndex: command.toIndex,
					});
					return;
				}

				if (command?.type === "reorder-tabs-over-tab") {
					dispatchWorkspaceDragCommand({
						type: "reorder-tabs-over-tab",
						activeTabId: command.activeTabId,
						overTabId: command.overTabId,
					});
					return;
				}

				const tabInsertInput = getWorkspaceItemTabInsertInput({
					event,
					items: orderedScopedItems,
				});

				if (tabInsertInput) {
					openItemInNewTab(tabInsertInput);
					return;
				}

				const moveInput = getWorkspaceItemMoveInput({
					event,
					items: orderedScopedItems,
					workspaceId: workspace.id,
				});

				if (moveInput) {
					moveWorkspaceItemMutation.mutate(moveInput);
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
								onCreateItem={createWorkspaceItem}
								onCloseItemView={
									isWorkspaceItemView(activeItem) ? closeItemView : undefined
								}
								onNavigateToRoot={openWorkspaceRoot}
								onNavigateToItem={openItem}
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

export function WorkspaceFrame({
	chrome,
	content,
	chatPanel,
}: WorkspaceFrameProps) {
	return (
		<div className="h-screen overflow-hidden bg-background text-foreground">
			<ResizablePanelGroup
				id="workspace-layout"
				orientation="horizontal"
				className="h-full min-h-0"
				resizeTargetMinimumSize={{ coarse: 37, fine: 27 }}
			>
				<ResizablePanel
					id="workspace"
					minSize="45%"
					className="min-h-0 overflow-hidden"
				>
					<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
						{chrome}
						<main className="min-h-0 flex-1 bg-background">{content}</main>
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
							className="min-h-0 overflow-hidden"
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
		<div className="h-screen overflow-hidden bg-background text-foreground">
			{children}
		</div>
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
