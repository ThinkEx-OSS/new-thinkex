import { PointerActivationConstraints } from "@dnd-kit/dom";
import {
	DragDropProvider,
	KeyboardSensor,
	PointerSensor,
} from "@dnd-kit/react";
import type { ReactNode } from "react";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "#/components/ui/resizable";
import AiChatPanel from "#/features/workspaces/components/AiChatPanel";
import WorkspaceContent from "#/features/workspaces/components/WorkspaceContent";
import WorkspaceContextBar from "#/features/workspaces/components/WorkspaceContextBar";
import WorkspaceTopBar from "#/features/workspaces/components/WorkspaceTopBar";
import { getWorkspaceDragCommand } from "#/features/workspaces/model/drag";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { useWorkspaceNavigation } from "#/features/workspaces/navigation/useWorkspaceNavigation";
import {
	useWorkspaceUiStore,
	type WorkspacePane,
	type WorkspacePresentation,
} from "#/features/workspaces/state/workspace-ui-store";
import type { WorkspaceSummary } from "#/lib/api/contracts";

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

export function WorkspaceShell({
	workspace,
	items,
	activeTabIdFromUrl,
	activeViewFromUrl,
}: WorkspaceShellProps) {
	const isCollapsed = useWorkspaceUiStore((state) => state.chatPanelCollapsed);
	const presentation = useWorkspaceUiStore((state) => state.presentation);
	const presentationHasChat = hasPaneKind(presentation, "chat");
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

	if (!session || !activeTab) {
		return <div className="min-h-screen bg-background text-foreground" />;
	}

	if (presentation.mode === "maximized") {
		return (
			<MaximizedWorkspaceSurface>
				<WorkspacePaneRenderer
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
			<div className="min-h-screen bg-background text-foreground">
				<ResizablePanelGroup
					id="workspace-layout"
					orientation="horizontal"
					className="min-h-screen"
					resizeTargetMinimumSize={{ coarse: 37, fine: 27 }}
				>
					<ResizablePanel id="workspace" minSize="45%">
						<div className="min-h-screen min-w-0">
							<WorkspaceTopBar
								workspace={workspace}
								itemsById={itemsById}
								tabs={session.tabs}
								activeTab={activeTab}
								onActivateTab={activateWorkspaceTab}
								onCloseTab={closeWorkspaceTab}
								onCreateRootTab={createWorkspaceTab}
							/>
							<main className="bg-background">
								<WorkspaceContextBar
									workspace={workspace}
									activeItem={activeItem}
									itemsById={itemsById}
									onCloseCurrentView={closeCurrentView}
									onNavigateToRoot={openWorkspaceRoot}
									onNavigateToItem={openItem}
								/>
								{presentation.mode === "split" ? (
									<WorkspaceSplitPresentation
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
								)}
							</main>
						</div>
					</ResizablePanel>

					{isCollapsed || presentationHasChat ? null : (
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
								<AiChatPanel />
							</ResizablePanel>
						</>
					)}
				</ResizablePanelGroup>
			</div>
		</DragDropProvider>
	);
}

function MaximizedWorkspaceSurface({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-screen bg-background text-foreground">{children}</div>
	);
}

function WorkspacePaneRenderer({
	pane,
	itemsById,
	scopedItems,
	onOpenItem,
}: {
	pane: WorkspacePane;
	itemsById: Map<string, WorkspaceItem>;
	scopedItems: WorkspaceItem[];
	onOpenItem: (item: WorkspaceItem) => void;
}) {
	switch (pane.kind) {
		case "chat":
			return <AiChatPanel />;
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
	panes,
	direction,
	itemsById,
	scopedItems,
	onOpenItem,
}: {
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
					pane={panes[0]}
					itemsById={itemsById}
					scopedItems={scopedItems}
					onOpenItem={onOpenItem}
				/>
			</ResizablePanel>
			<ResizableHandle withHandle={true} />
			<ResizablePanel id={panes[1].id} minSize="18rem">
				<WorkspacePaneRenderer
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
