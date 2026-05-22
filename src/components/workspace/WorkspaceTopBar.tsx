import { Link } from "@tanstack/react-router";
import { PanelRightOpen } from "lucide-react";

import ThinkExLogo from "#/components/ThinkExLogo";
import { Button } from "#/components/ui/button";
import type { WorkspaceItem } from "#/components/workspace/types";
import WorkspaceTabBar from "#/components/workspace/WorkspaceTabBar";
import type { WorkspaceSummary } from "#/lib/api/contracts";
import { useAiChatPanelStore } from "#/stores/ai-chat-panel";
import type { WorkspaceTab } from "#/stores/workspace-tabs";

interface WorkspaceTopBarProps {
	workspace: WorkspaceSummary;
	itemsById: Map<string, WorkspaceItem>;
	tabs: WorkspaceTab[];
	activeTab: WorkspaceTab;
	onActivateTab: (tab: WorkspaceTab) => void;
	onCloseTab: (tab: WorkspaceTab) => void;
	onCreateRootTab: () => void;
}

export default function WorkspaceTopBar({
	workspace,
	itemsById,
	tabs,
	activeTab,
	onActivateTab,
	onCloseTab,
	onCreateRootTab,
}: WorkspaceTopBarProps) {
	const isCollapsed = useAiChatPanelStore((state) => state.isCollapsed);
	const openAiChat = useAiChatPanelStore((state) => state.open);

	return (
		<header className="sticky top-0 z-40 border-b border-border bg-background">
			<div className="flex h-14 w-full items-center justify-between px-4">
				<div className="flex min-w-0 items-center gap-4">
					<Link
						to="/home"
						className="flex shrink-0 items-center gap-3 rounded-md text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ThinkExLogo size={28} />
						<span className="text-xl font-semibold tracking-tight sm:text-2xl">
							ThinkEx
						</span>
					</Link>

					<div className="h-6 w-px bg-border" aria-hidden="true" />

					<WorkspaceTabBar
						workspace={workspace}
						itemsById={itemsById}
						tabs={tabs}
						activeTab={activeTab}
						onActivateTab={onActivateTab}
						onCloseTab={onCloseTab}
						onCreateRootTab={onCreateRootTab}
					/>
				</div>

				<nav className="flex items-center gap-2" aria-label="Workspace">
					{isCollapsed ? (
						<Button
							variant="outline"
							size="sm"
							className="h-8 gap-1.5"
							onClick={openAiChat}
						>
							<PanelRightOpen className="size-3.5" />
							AI Chat
						</Button>
					) : null}
				</nav>
			</div>
		</header>
	);
}
