import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "#/components/ui/resizable";
import AiChatPanel, {
	AiChatPanelMaximized,
} from "#/components/workspace/AiChatPanel";
import type { WorkspaceItem } from "#/components/workspace/types";
import { useWorkspaceNavigation } from "#/components/workspace/useWorkspaceNavigation";
import WorkspaceContent from "#/components/workspace/WorkspaceContent";
import WorkspaceContextBar from "#/components/workspace/WorkspaceContextBar";
import WorkspaceTopBar from "#/components/workspace/WorkspaceTopBar";
import type { WorkspaceSummary } from "#/lib/api/contracts";
import { useAiChatPanelStore } from "#/stores/ai-chat-panel";

export type { WorkspaceItem } from "#/components/workspace/types";

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
	const isCollapsed = useAiChatPanelStore((state) => state.isCollapsed);
	const isMaximized = useAiChatPanelStore((state) => state.isMaximized);
	const {
		activeItem,
		activeTab,
		activateWorkspaceTab,
		closeCurrentView,
		closeWorkspaceTab,
		createWorkspaceTab,
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

	return (
		<div className="min-h-screen bg-background text-foreground">
			{isMaximized ? <AiChatPanelMaximized /> : null}

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
							<WorkspaceContent
								items={scopedItems}
								activeItem={activeItem}
								onOpenItem={openItem}
							/>
						</main>
					</div>
				</ResizablePanel>

				{isCollapsed ? null : (
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
	);
}
