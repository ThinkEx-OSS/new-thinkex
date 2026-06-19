import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import { WorkspaceShareRoleMenu } from "#/features/workspaces/components/WorkspaceShareRoleMenu";
import {
	getWorkspaceEmailInvitesQueryKey,
	getWorkspaceMembersQueryKey,
} from "#/features/workspaces/components/workspace-share-queries";
import {
	type WorkspaceEmailInviteSummary,
	type WorkspaceMemberSummary,
	type WorkspaceMembershipRole,
	workspaceRoleLabels,
} from "#/features/workspaces/contracts";
import { cancelWorkspaceEmailInviteFn } from "#/features/workspaces/invites/workspace-invite-functions";
import {
	canGrantRole,
	canManageMember,
	getAssignableMemberRoles,
} from "#/features/workspaces/invites/workspace-invite-rules";
import {
	removeWorkspaceMemberFn,
	updateWorkspaceMemberRoleFn,
} from "#/features/workspaces/members/workspace-member-functions";
import { getAuthSessionQueryOptions } from "#/lib/session-query";

function getInitials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	const first = parts[0]?.[0] ?? "";
	const second = parts[1]?.[0] ?? "";
	const fallback = name[0] ?? "?";

	return `${first}${second}`.toUpperCase() || fallback.toUpperCase();
}

export function WorkspaceShareMemberList({
	emailInvites,
	isLoading,
	members,
	membershipRole,
	workspaceId,
}: {
	emailInvites: WorkspaceEmailInviteSummary[];
	isLoading: boolean;
	members: WorkspaceMemberSummary[];
	membershipRole: WorkspaceMembershipRole;
	workspaceId: string;
}) {
	const queryClient = useQueryClient();
	const assignableRoles = getAssignableMemberRoles(membershipRole);
	const sessionQuery = useQuery(getAuthSessionQueryOptions());
	const currentUserId = sessionQuery.data?.user.id;

	const updateRoleMutation = useMutation({
		mutationFn: updateWorkspaceMemberRoleFn,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: getWorkspaceMembersQueryKey(workspaceId),
			});
		},
		onError: () => toast.error("Could not update member role"),
	});

	const removeMemberMutation = useMutation({
		mutationFn: removeWorkspaceMemberFn,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: getWorkspaceMembersQueryKey(workspaceId),
			});
		},
		onError: () => toast.error("Could not remove member"),
	});

	const cancelInviteMutation = useMutation({
		mutationFn: cancelWorkspaceEmailInviteFn,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: getWorkspaceEmailInvitesQueryKey(workspaceId),
			});
			toast.success("Invite cancelled");
		},
		onError: () => toast.error("Could not cancel invite"),
	});

	if (isLoading) {
		return (
			<p className="px-2 py-3 text-sm text-muted-foreground">
				Loading members...
			</p>
		);
	}

	return (
		<div className="space-y-1">
			{emailInvites.map((invite) => (
				<WorkspaceShareEmailInviteRow
					key={invite.id}
					canCancel={canGrantRole(membershipRole, invite.role)}
					invite={invite}
					onCancel={() =>
						cancelInviteMutation.mutate({
							data: {
								workspaceId,
								inviteId: invite.id,
							},
						})
					}
				/>
			))}
			{members.map((member) => (
				<WorkspaceShareMemberRow
					key={member.userId}
					assignableRoles={assignableRoles}
					canManage={
						member.userId !== currentUserId &&
						canManageMember(membershipRole, member.role)
					}
					member={member}
					onRemove={() =>
						removeMemberMutation.mutate({
							data: {
								workspaceId,
								userId: member.userId,
							},
						})
					}
					onRoleChange={(role) =>
						updateRoleMutation.mutate({
							data: {
								workspaceId,
								userId: member.userId,
								role,
							},
						})
					}
				/>
			))}
		</div>
	);
}

function WorkspaceShareEmailInviteRow({
	canCancel,
	invite,
	onCancel,
}: {
	canCancel: boolean;
	invite: WorkspaceEmailInviteSummary;
	onCancel: () => void;
}) {
	return (
		<div className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/50">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
				<Mail className="size-4 text-muted-foreground" />
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm">{invite.email}</p>
				<p className="text-muted-foreground text-xs">Invited</p>
			</div>
			<span className="shrink-0 px-2 text-sm text-muted-foreground">
				{workspaceRoleLabels[invite.role]}
			</span>
			{canCancel ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={`Cancel invite for ${invite.email}`}
					onClick={onCancel}
				>
					<X />
				</Button>
			) : null}
		</div>
	);
}

function WorkspaceShareMemberRow({
	assignableRoles,
	canManage,
	member,
	onRemove,
	onRoleChange,
}: {
	assignableRoles: WorkspaceMembershipRole[];
	canManage: boolean;
	member: WorkspaceMemberSummary;
	onRemove: () => void;
	onRoleChange: (role: WorkspaceMembershipRole) => void;
}) {
	return (
		<div className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/50">
			<Avatar size="sm">
				<AvatarImage src={member.image ?? undefined} alt="" />
				<AvatarFallback className="text-xs">
					{getInitials(member.name)}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm">{member.name}</p>
			</div>
			{canManage ? (
				<>
					<WorkspaceShareRoleMenu
						onValueChange={onRoleChange}
						roles={assignableRoles}
						value={member.role}
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`Remove ${member.name}`}
						onClick={onRemove}
					>
						<X />
					</Button>
				</>
			) : (
				<span className="shrink-0 px-2 text-sm text-muted-foreground">
					{workspaceRoleLabels[member.role]}
				</span>
			)}
		</div>
	);
}
