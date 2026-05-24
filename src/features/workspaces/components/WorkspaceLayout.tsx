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
} from "react";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "#/components/ui/resizable";
import {
	upsertWorkspaceItemInCaches,
	workspaceItemsQueryKey,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import AiChatPanel from "#/features/workspaces/components/AiChatPanel";
import WorkspaceContent from "#/features/workspaces/components/WorkspaceContent";
import WorkspaceContextBar from "#/features/workspaces/components/WorkspaceContextBar";
import WorkspaceTopBar from "#/features/workspaces/components/WorkspaceTopBar";
import type { WorkspaceSummary } from "#/features/workspaces/contracts";
import { getWorkspaceDragCommand } from "#/features/workspaces/model/drag";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { useWorkspaceNavigation } from "#/features/workspaces/navigation/useWorkspaceNavigation";
import type { WorkspaceRealtimeEvent } from "#/features/workspaces/realtime/messages";
import { useWorkspaceRealtime } from "#/features/workspaces/realtime/use-workspace-presence";
import {
	useWorkspaceUiStore,
	type WorkspacePane,
	type WorkspacePresentation,
} from "#/features/workspaces/state/workspace-ui-store";
import {
	createWorkspaceItemMutationInput,
	useCreateWorkspaceItemMutation,
} from "#/features/workspaces/use-create-workspace-item";

export type { WorkspaceItem } from "#/features/workspaces/model/types";

const workspaceDragSensors = [
	PointerSensor.configure({
		activationConstraints: [
			new PointerActivationConstraints.Distance({ value: 6 }),
		],
	}),
	KeyboardSensor,
];

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
	const ensureWorkspaceUiSession = useWorkspaceUiStore(
		(state) => state.ensureWorkspaceSession,
	);
	const handleWorkspaceRealtimeEvent = useCallback(
		(event: WorkspaceRealtimeEvent) => {
			if (event.workspaceId !== workspace.id) {
				return;
			}

			upsertWorkspaceItemInCaches(queryClient, event.payload.item);
		},
		[queryClient, workspace.id],
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

	useEffect(() => {
		ensureWorkspaceUiSession({
			workspaceId: workspace.id,
			validItemIds,
		});
	}, [ensureWorkspaceUiSession, validItemIds, workspace.id]);

	if (!session || !activeTab) {
		return <div className="min-h-screen bg-background text-foreground" />;
	}

	if (presentation.mode === "maximized") {
		return (
			<MaximizedWorkspaceSurface>
				<WorkspacePaneRenderer
					workspaceId={workspace.id}
					pane={presentation.pane}
					itemsById={itemsById}
					scopedItems={scopedItems}
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

				if (command) {
					dispatchWorkspaceDragCommand(command);
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
											existingItems: scopedItems,
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
							scopedItems={scopedItems}
							onOpenItem={openItem}
						/>
					) : (
						<WorkspaceContent
							items={scopedItems}
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
							className="relative z-[45] -mx-[13px] hidden w-[27px] items-stretch justify-center bg-transparent outline-none after:hidden [&[data-separator=active]>div]:w-[3px] [&[data-separator=active]>div]:bg-ring [&[data-separator=hover]>div]:w-[3px] [&[data-separator=hover]>div]:bg-ring/70 lg:flex"
							onPointerUp={(event) => event.currentTarget.blur()}
						>
							<div className="my-0 w-px bg-border transition-[background-color,width] duration-150" />
						</ResizableHandle>
						<ResizablePanel
							id="ai-chat"
							defaultSize="30rem"
							minSize="26rem"
							maxSize="60%"
							className="hidden lg:block"
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
	onOpenItem: (item: WorkspaceItem) => void;
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
	onOpenItem: (item: WorkspaceItem) => void;
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
