export function getWorkspaceMembersQueryKey(workspaceId: string) {
	return ["workspace-members", workspaceId] as const;
}

export function getWorkspaceEmailInvitesQueryKey(workspaceId: string) {
	return ["workspace-email-invites", workspaceId] as const;
}

export function getWorkspaceInviteLinkQueryKey(
	workspaceId: string,
	role: string,
) {
	return ["workspace-invite-link", workspaceId, role] as const;
}
