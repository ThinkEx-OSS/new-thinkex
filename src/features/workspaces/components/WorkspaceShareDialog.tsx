import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Link2, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
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
	isWorkspaceInviteLinkCacheValid,
	resolveWorkspaceInviteLink,
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
import { buildClientAbsoluteUrl } from "#/lib/client-url";

const defaultInviteLinkExpiryDays = defaultInviteLinkExpiryMs / 86_400_000;

interface WorkspaceShareDialogProps {
	membershipRole: WorkspaceMembershipRole;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	workspaceId: string;
	workspaceName: string;
}

export function WorkspaceShareDialog({
	membershipRole,
	onOpenChange,
	open,
	workspaceId,
	workspaceName,
}: WorkspaceShareDialogProps) {
	const queryClient = useQueryClient();
	const [copyingRole, setCopyingRole] =
		useState<WorkspaceMembershipRole | null>(null);
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
		const cached = queryClient.getQueryData(
			getWorkspaceInviteLinkQueryOptions(workspaceId, role).queryKey,
		);
		const needsFetch = !isWorkspaceInviteLinkCacheValid(cached);

		if (needsFetch) {
			setCopyingRole(role);
		}

		try {
			const result = await resolveWorkspaceInviteLink(
				queryClient,
				workspaceId,
				role,
			);

			await copy(buildClientAbsoluteUrl(result.path));
		} catch {
			toast.error("Could not create invite link");
		} finally {
			setCopyingRole(null);
		}
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
							render={
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={copyingRole !== null}
								/>
							}
						>
							{copyingRole !== null ? (
								<Loader2 className="animate-spin" />
							) : copied ? (
								<Check />
							) : (
								<Link2 />
							)}
							{copyingRole !== null
								? "Copying…"
								: copied
									? "Copied"
									: "Copy link"}
							{copyingRole !== null || copied ? null : (
								<ChevronDown className="size-4 opacity-60" />
							)}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" side="bottom" className="w-56">
							<DropdownMenuGroup>
								<DropdownMenuLabel className="font-normal">
									Join as · expires in {defaultInviteLinkExpiryDays} days
								</DropdownMenuLabel>
								{grantableRoles.map((role) => (
									<DropdownMenuItem
										key={role}
										disabled={copyingRole !== null}
										onClick={() => {
											void copyInviteLinkForRole(role);
										}}
									>
										{copyingRole === role ? (
											<Loader2 className="animate-spin" />
										) : null}
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
