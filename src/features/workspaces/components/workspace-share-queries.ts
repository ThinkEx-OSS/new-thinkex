import {
	type QueryClient,
	queryOptions,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

import type { WorkspaceMembershipRole } from "#/features/workspaces/contracts";
import {
	getWorkspaceInviteLinkFn,
	listWorkspaceEmailInvitesFn,
} from "#/features/workspaces/invites/workspace-invite-functions";
import { defaultInviteLinkExpiryMs } from "#/features/workspaces/invites/workspace-invite-rules";
import { listWorkspaceMembersFn } from "#/features/workspaces/members/workspace-member-functions";

export function getWorkspaceMembersQueryKey(workspaceId: string) {
	return ["workspace-members", workspaceId] as const;
}

export function getWorkspaceEmailInvitesQueryKey(workspaceId: string) {
	return ["workspace-email-invites", workspaceId] as const;
}

export function getWorkspaceInviteLinkQueryKey(
	workspaceId: string,
	role: WorkspaceMembershipRole,
) {
	return ["workspace-invite-link", workspaceId, role] as const;
}

export function getWorkspaceMembersQueryOptions(workspaceId: string) {
	return queryOptions({
		queryKey: getWorkspaceMembersQueryKey(workspaceId),
		queryFn: () => listWorkspaceMembersFn({ data: { workspaceId } }),
	});
}

export function getWorkspaceEmailInvitesQueryOptions(workspaceId: string) {
	return queryOptions({
		queryKey: getWorkspaceEmailInvitesQueryKey(workspaceId),
		queryFn: () => listWorkspaceEmailInvitesFn({ data: { workspaceId } }),
	});
}

export function getWorkspaceInviteLinkQueryOptions(
	workspaceId: string,
	role: WorkspaceMembershipRole,
) {
	return queryOptions({
		queryKey: getWorkspaceInviteLinkQueryKey(workspaceId, role),
		queryFn: () =>
			getWorkspaceInviteLinkFn({
				data: {
					workspaceId,
					role,
				},
			}),
		staleTime: defaultInviteLinkExpiryMs,
	});
}

export function prefetchWorkspaceInviteLinks(
	queryClient: QueryClient,
	workspaceId: string,
	roles: readonly WorkspaceMembershipRole[],
) {
	return Promise.all(
		roles.map((role) =>
			queryClient.prefetchQuery(
				getWorkspaceInviteLinkQueryOptions(workspaceId, role),
			),
		),
	);
}

export function useWorkspaceShareDialogQueries({
	grantableRoles,
	open,
	workspaceId,
}: {
	grantableRoles: WorkspaceMembershipRole[];
	open: boolean;
	workspaceId: string;
}) {
	const queryClient = useQueryClient();

	const membersQuery = useQuery({
		...getWorkspaceMembersQueryOptions(workspaceId),
		enabled: open,
	});

	const emailInvitesQuery = useQuery({
		...getWorkspaceEmailInvitesQueryOptions(workspaceId),
		enabled: open,
	});

	useEffect(() => {
		if (!open || grantableRoles.length === 0) {
			return;
		}

		void prefetchWorkspaceInviteLinks(queryClient, workspaceId, grantableRoles);
	}, [grantableRoles, open, queryClient, workspaceId]);

	return {
		emailInvites: emailInvitesQuery.data ?? [],
		isLoading: membersQuery.isLoading || emailInvitesQuery.isLoading,
		members: membersQuery.data ?? [],
	};
}
