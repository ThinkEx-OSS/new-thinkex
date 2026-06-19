import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Link2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { WorkspaceShareEmailInviteField } from "#/features/workspaces/components/WorkspaceShareEmailInviteField";
import { WorkspaceShareMemberList } from "#/features/workspaces/components/WorkspaceShareMemberList";
import {
	getWorkspaceInviteLinkQueryOptions,
	useWorkspaceShareDialogQueries,
} from "#/features/workspaces/components/workspace-share-queries";
import {
	type WorkspaceMembershipRole,
	workspaceRoleLabels,
} from "#/features/workspaces/contracts";
import {
	defaultInviteLinkExpiryMs,
	getGrantableInviteRoles,
} from "#/features/workspaces/invites/workspace-invite-rules";
import { useCopyToClipboard } from "#/hooks/use-copy-to-clipboard";

const defaultInviteLinkExpiryDays = defaultInviteLinkExpiryMs / 86_400_000;

interface WorkspaceShareDialogProps {
	membershipRole: WorkspaceMembershipRole;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	workspaceId: string;
	workspaceName: string;
}

function getInviteUrl(path: string) {
	if (typeof window === "undefined") {
		return path;
	}

	return `${window.location.origin}${path}`;
}

export function WorkspaceShareDialog({
	membershipRole,
	onOpenChange,
	open,
	workspaceId,
	workspaceName,
}: WorkspaceShareDialogProps) {
	const queryClient = useQueryClient();
	const grantableRoles = useMemo(
		() => getGrantableInviteRoles(membershipRole),
		[membershipRole],
	);
	const { copied, copy } = useCopyToClipboard({
		resetTimeoutMs: 2000,
		onError: () => toast.error("Could not copy invite link"),
	});
	const { emailInvites, isLoading, members } = useWorkspaceShareDialogQueries({
		grantableRoles,
		open,
		workspaceId,
	});

	async function copyInviteLinkForRole(role: WorkspaceMembershipRole) {
		const result = await queryClient.ensureQueryData(
			getWorkspaceInviteLinkQueryOptions(workspaceId, role),
		);

		await copy(getInviteUrl(result.path));
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[min(36rem,85vh)] flex-col gap-4 sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Share workspace</DialogTitle>
					<DialogDescription>
						Invite people to collaborate on {workspaceName}.
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-hidden rounded-md border">
					<WorkspaceShareEmailInviteField
						membershipRole={membershipRole}
						open={open}
						workspaceId={workspaceId}
					/>
					<div className="min-h-0 max-h-64 overflow-y-auto p-1">
						<WorkspaceShareMemberList
							emailInvites={emailInvites}
							isLoading={isLoading}
							members={members}
							membershipRole={membershipRole}
							workspaceId={workspaceId}
						/>
					</div>
				</div>

				<DialogFooter className="flex-row items-center justify-end gap-2 border-t pt-4">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button type="button" variant="outline" size="sm" />}
						>
							{copied ? <Check /> : <Link2 />}
							{copied ? "Copied" : "Copy link"}
							{copied ? null : <ChevronDown className="size-4 opacity-60" />}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" side="bottom" className="w-56">
							<DropdownMenuGroup>
								<DropdownMenuLabel className="font-normal">
									Join as · expires in {defaultInviteLinkExpiryDays} days
								</DropdownMenuLabel>
								{grantableRoles.map((role) => (
									<DropdownMenuItem
										key={role}
										onClick={() => {
											void copyInviteLinkForRole(role);
										}}
									>
										{workspaceRoleLabels[role]}
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
