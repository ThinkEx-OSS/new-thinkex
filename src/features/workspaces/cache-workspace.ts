import type { QueryClient } from "@tanstack/react-query";
import {
	workspacePageQueryKey,
	workspaceQueryKey,
	workspacesQueryKey,
} from "#/features/workspaces/cache-keys";
import type {
	WorkspaceItemSummary,
	WorkspaceMembershipRole,
	WorkspacePage,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";

type WorkspaceListCacheMode = "upsert" | "update-existing" | "skip";

type SeedWorkspacePageInput = {
	workspace: WorkspaceSummary;
	items: WorkspaceItemSummary[];
	revision?: number;
	membershipRole: WorkspaceMembershipRole;
};

export function seedWorkspaceCaches(
	queryClient: QueryClient,
	input: SeedWorkspacePageInput | { workspace: WorkspaceSummary },
	options: {
		listMode?: WorkspaceListCacheMode;
	} = {},
) {
	const { workspace } = input;
	const listMode = options.listMode ?? "upsert";

	if (listMode !== "skip") {
		queryClient.setQueryData<WorkspaceSummary[]>(
			workspacesQueryKey,
			(current) => {
				if (!current && listMode === "update-existing") {
					return undefined;
				}

				if (!current) {
					return [workspace];
				}

				if (current.some((item) => item.id === workspace.id)) {
					return current
						.map((item) => (item.id === workspace.id ? workspace : item))
						.sort(compareWorkspaceRecentFirst);
				}

				return [workspace, ...current].sort(compareWorkspaceRecentFirst);
			},
		);
	}

	queryClient.setQueryData(workspaceQueryKey(workspace.id), workspace);

	if ("items" in input) {
		const membershipRole =
			input.membershipRole ??
			queryClient.getQueryData<WorkspacePage>(
				workspacePageQueryKey(workspace.id),
			)?.membershipRole;

		if (!membershipRole) {
			return;
		}

		queryClient.setQueryData<WorkspacePage>(
			workspacePageQueryKey(workspace.id),
			(current) =>
				createWorkspacePageCacheEntry({
					workspace,
					items: input.items,
					revision: input.revision ?? current?.revision ?? 0,
					membershipRole,
				}),
		);
	}
}

function createWorkspacePageCacheEntry(input: {
	workspace: WorkspaceSummary;
	items: WorkspaceItemSummary[];
	revision: number;
	membershipRole: WorkspaceMembershipRole;
}): WorkspacePage {
	return {
		workspace: input.workspace,
		items: input.items,
		revision: input.revision,
		membershipRole: input.membershipRole,
	};
}

export function restoreWorkspaceListCache(
	queryClient: QueryClient,
	workspaces: WorkspaceSummary[] | undefined,
) {
	if (workspaces) {
		queryClient.setQueryData(workspacesQueryKey, workspaces);
		return;
	}

	queryClient.removeQueries({ queryKey: workspacesQueryKey });
}

export function removeWorkspaceFromListCache(
	queryClient: QueryClient,
	workspaceId: string,
) {
	const previousWorkspaces =
		queryClient.getQueryData<WorkspaceSummary[]>(workspacesQueryKey);

	queryClient.setQueryData<WorkspaceSummary[]>(workspacesQueryKey, (current) =>
		current?.filter((workspace) => workspace.id !== workspaceId),
	);

	return previousWorkspaces;
}

export function markWorkspaceOpenedInCache(
	queryClient: QueryClient,
	workspaceId: string,
	openedAt: string,
) {
	const updateWorkspace = (workspace: WorkspaceSummary) =>
		workspace.id === workspaceId
			? { ...workspace, lastOpenedAt: openedAt }
			: workspace;

	queryClient.setQueryData<WorkspaceSummary[]>(workspacesQueryKey, (current) =>
		current?.map(updateWorkspace).sort(compareWorkspaceRecentFirst),
	);
	queryClient.setQueryData<WorkspaceSummary>(
		workspaceQueryKey(workspaceId),
		(current) => (current ? updateWorkspace(current) : current),
	);
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(workspaceId),
		(current) =>
			current
				? {
						...current,
						workspace: updateWorkspace(current.workspace),
					}
				: current,
	);
}

export function updateWorkspaceInCaches(
	queryClient: QueryClient,
	workspace: WorkspaceSummary,
) {
	seedWorkspaceCaches(
		queryClient,
		{ workspace },
		{ listMode: "update-existing" },
	);
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(workspace.id),
		(current) =>
			current
				? {
						...current,
						workspace,
					}
				: current,
	);
}

export function removeWorkspaceCaches(
	queryClient: QueryClient,
	workspaceId: string,
) {
	removeWorkspaceFromListCache(queryClient, workspaceId);
	removeWorkspaceDetailCaches(queryClient, workspaceId);
}

export function removeWorkspaceDetailCaches(
	queryClient: QueryClient,
	workspaceId: string,
) {
	queryClient.removeQueries({ queryKey: workspaceQueryKey(workspaceId) });
	queryClient.removeQueries({ queryKey: workspacePageQueryKey(workspaceId) });
}

function compareWorkspaceRecentFirst(
	left: WorkspaceSummary,
	right: WorkspaceSummary,
) {
	const leftRecentAt = left.lastOpenedAt ?? left.createdAt;
	const rightRecentAt = right.lastOpenedAt ?? right.createdAt;
	const recentDelta = rightRecentAt.localeCompare(leftRecentAt);

	if (recentDelta !== 0) {
		return recentDelta;
	}

	return left.name.localeCompare(right.name);
}
