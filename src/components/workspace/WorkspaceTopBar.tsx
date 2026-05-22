import { Link } from "@tanstack/react-router";
import { MessageCircle, Share2 } from "lucide-react";

import ThinkExLogo from "#/components/ThinkExLogo";
import UserProfileDropdown from "#/components/UserProfileDropdown";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
} from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import type { WorkspaceItem } from "#/components/workspace/types";
import WorkspaceTabBar from "#/components/workspace/WorkspaceTabBar";
import type { WorkspaceSummary } from "#/lib/api/contracts";
import { cn } from "#/lib/utils";
import { useAiChatPanelStore } from "#/stores/ai-chat-panel";
import type { WorkspaceTab } from "#/stores/workspace-tabs";

const workspaceCollaborators = [
	{
		name: "Urjit",
		role: "Owner",
		initials: "U",
		className: "bg-sky-500 text-white",
	},
	{
		name: "Avery",
		role: "Editor",
		initials: "A",
		className: "bg-emerald-500 text-white",
	},
	{
		name: "Mira",
		role: "Viewer",
		initials: "M",
		className: "bg-violet-500 text-white",
	},
	{
		name: "Noah",
		role: "Viewer",
		initials: "N",
		className: "bg-amber-500 text-white",
	},
];

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
		<header className="sticky top-0 z-40 bg-background/95">
			<div className="flex h-12 w-full items-center justify-between gap-3 px-4">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					<Link
						to="/home"
						className="flex shrink-0 items-center gap-3 rounded-md text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ThinkExLogo size={28} />
						<span className="text-xl font-semibold tracking-tight sm:text-2xl">
							ThinkEx
						</span>
					</Link>

					<div className="h-5 w-px bg-border/70" aria-hidden="true" />

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

				{isCollapsed ? (
					<nav
						className="flex shrink-0 items-center gap-2"
						aria-label="Workspace global actions"
					>
						<Button
							variant="ghost"
							size="icon-sm"
							type="button"
							className="text-muted-foreground hover:text-foreground"
							aria-label="Share workspace"
						>
							<Share2 className="size-3.5" />
						</Button>
						<WorkspaceCollaborators />
						<UserProfileDropdown />
						<Button
							variant="outline"
							size="sm"
							type="button"
							className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
							onClick={openAiChat}
						>
							<MessageCircle className="size-3.5" />
							<span className="hidden lg:inline">AI Chat</span>
						</Button>
					</nav>
				) : (
					<nav
						className="flex shrink-0 items-center gap-2"
						aria-label="Workspace global actions"
					>
						<Button
							variant="ghost"
							size="icon-sm"
							type="button"
							className="text-muted-foreground hover:text-foreground"
							aria-label="Share workspace"
						>
							<Share2 className="size-3.5" />
						</Button>
						<WorkspaceCollaborators />
						<UserProfileDropdown />
					</nav>
				)}
			</div>
		</header>
	);
}

function WorkspaceCollaborators() {
	return (
		<div className="group/collaborators relative">
			<AvatarGroup
				tabIndex={0}
				aria-label="Workspace collaborators"
				className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{workspaceCollaborators.slice(0, 2).map((collaborator) => (
					<Avatar key={collaborator.name} size="sm">
						<AvatarFallback className={collaborator.className}>
							{collaborator.initials}
						</AvatarFallback>
					</Avatar>
				))}
				<AvatarGroupCount className="size-6 text-xs">
					+{workspaceCollaborators.length - 2}
				</AvatarGroupCount>
			</AvatarGroup>

			<div className="pointer-events-none absolute top-full right-0 z-50 mt-2 w-56 rounded-md bg-popover p-2 text-popover-foreground opacity-0 shadow-md ring-1 ring-foreground/10 transition-opacity delay-0 duration-150 group-hover/collaborators:pointer-events-auto group-hover/collaborators:delay-300 group-hover/collaborators:opacity-100 group-focus-within/collaborators:pointer-events-auto group-focus-within/collaborators:opacity-100">
				<div className="space-y-1">
					{workspaceCollaborators.map((collaborator) => (
						<div
							key={collaborator.name}
							className="flex items-center gap-2 rounded-sm px-2 py-1.5"
						>
							<Avatar size="sm">
								<AvatarFallback
									className={cn("text-xs", collaborator.className)}
								>
									{collaborator.initials}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">
									{collaborator.name}
								</p>
								<p className="truncate text-xs text-muted-foreground">
									{collaborator.role}
								</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
