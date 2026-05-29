import { Link } from "@tanstack/react-router";
import { MessageCircle, Share2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import ThinkExLogo from "#/components/ThinkExLogo";
import UserProfileDropdown from "#/components/UserProfileDropdown";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Field, FieldGroup } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Kbd } from "#/components/ui/kbd";
import { Label } from "#/components/ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { WorkspacePresence } from "#/features/workspaces/components/WorkspacePresence";
import WorkspaceTabBar from "#/features/workspaces/components/WorkspaceTabBar";
import type { WorkspaceSummary } from "#/features/workspaces/contracts";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import type { WorkspacePresenceUser } from "#/features/workspaces/realtime/messages";
import type { WorkspaceTab } from "#/features/workspaces/state/workspace-tabs-store";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";
import { formatAppHotkey, getAppHotkey } from "#/lib/hotkeys-core";

type PresenceStatus = "connecting" | "connected" | "disconnected";

interface WorkspaceTopBarProps {
	workspace: WorkspaceSummary;
	itemsById: Map<string, WorkspaceItem>;
	tabs: WorkspaceTab[];
	activeTab: WorkspaceTab;
	contextBar: ReactNode;
	presence: {
		status: PresenceStatus;
		users: WorkspacePresenceUser[];
	};
	onActivateTab: (tab: WorkspaceTab) => void;
	onCloseTab: (tab: WorkspaceTab) => void;
	onCloseOtherTabs: (tab: WorkspaceTab) => void;
	onCloseTabsToRight: (tab: WorkspaceTab) => void;
	onCreateRootTab: () => void;
	onCreateRootTabAfter: (tab: WorkspaceTab) => void;
	onDuplicateTab: (tab: WorkspaceTab) => void;
}

export default function WorkspaceTopBar({
	workspace,
	itemsById,
	tabs,
	activeTab,
	contextBar,
	presence,
	onActivateTab,
	onCloseTab,
	onCloseOtherTabs,
	onCloseTabsToRight,
	onCreateRootTab,
	onCreateRootTabAfter,
	onDuplicateTab,
}: WorkspaceTopBarProps) {
	const isCollapsed = useWorkspaceUiStore(
		(state) =>
			state.sessionsByWorkspaceId[workspace.id]?.chatPanelCollapsed ?? false,
	);
	const openAiChat = useWorkspaceUiStore((state) => state.openChatPanel);
	const [shareOpen, setShareOpen] = useState(false);
	const aiChatHotkey = formatAppHotkey(
		getAppHotkey("workspace.aiChat.toggle").hotkey,
	);

	return (
		<header className="sticky top-0 z-40 bg-background/95">
			<div className="flex h-12 w-full items-stretch justify-between gap-3 px-4">
				<div className="flex min-w-0 flex-1 items-stretch gap-4">
					<Link
						to="/home"
						className="flex shrink-0 items-center gap-3 rounded-md text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ThinkExLogo size={28} />
						<span className="text-xl font-semibold tracking-tight sm:text-2xl">
							ThinkEx
						</span>
					</Link>
					<WorkspaceTabBar
						workspace={workspace}
						itemsById={itemsById}
						tabs={tabs}
						activeTab={activeTab}
						onActivateTab={onActivateTab}
						onCloseTab={onCloseTab}
						onCloseOtherTabs={onCloseOtherTabs}
						onCloseTabsToRight={onCloseTabsToRight}
						onCreateRootTab={onCreateRootTab}
						onCreateRootTabAfter={onCreateRootTabAfter}
						onDuplicateTab={onDuplicateTab}
					/>
				</div>

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
						onClick={() => setShareOpen(true)}
					>
						<Share2 className="size-3.5" />
					</Button>
					<WorkspacePresence status={presence.status} users={presence.users} />
					<UserProfileDropdown />
					{isCollapsed ? (
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										variant="outline"
										size="sm"
										type="button"
										className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
										onClick={() => openAiChat(workspace.id)}
									>
										<MessageCircle className="size-3.5" />
										<span className="hidden lg:inline">AI Chat</span>
									</Button>
								}
							/>
							<TooltipContent>
								<span>AI Chat</span>
								<Kbd>{aiChatHotkey}</Kbd>
							</TooltipContent>
						</Tooltip>
					) : null}
				</nav>
			</div>
			{contextBar}
			<Dialog open={shareOpen} onOpenChange={setShareOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Share workspace</DialogTitle>
						<DialogDescription>
							Invite people to collaborate on {workspace.name}.
						</DialogDescription>
					</DialogHeader>
					<FieldGroup className="min-w-0 gap-4">
						<Field>
							<Label htmlFor="workspace-share-email">Email address</Label>
							<Input
								id="workspace-share-email"
								type="email"
								placeholder="teammate@example.com"
							/>
						</Field>
						<div className="min-w-0 rounded-md border bg-muted/30 px-3 py-2 text-sm">
							<div className="font-medium">Workspace link</div>
							<div className="truncate text-muted-foreground">
								thinkex.app/workspaces/{workspace.id}
							</div>
						</div>
					</FieldGroup>
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Cancel
						</DialogClose>
						<Button type="button" onClick={() => setShareOpen(false)}>
							Send invite
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</header>
	);
}
