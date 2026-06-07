import type { QueryClient } from "@tanstack/react-query";
import {
	workspacePageQueryKey,
	workspaceQueryKey,
	workspacesQueryKey,
} from "#/features/workspaces/cache-keys";
import { restoreWorkspaceListCache } from "#/features/workspaces/cache-workspace";
import type {
	WorkspacePage,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";

export type WorkspaceCacheSnapshot = {
	page: WorkspacePage | undefined;
	workspace: WorkspaceSummary | undefined;
	workspaces: WorkspaceSummary[] | undefined;
};

export async function cancelWorkspaceCaches(
	queryClient: QueryClient,
	workspaceId: string,
) {
	await Promise.all([
		queryClient.cancelQueries({ queryKey: workspacesQueryKey }),
		queryClient.cancelQueries({ queryKey: workspaceQueryKey(workspaceId) }),
		queryClient.cancelQueries({ queryKey: workspacePageQueryKey(workspaceId) }),
	]);
}

export function getWorkspaceCacheSnapshot(
	queryClient: QueryClient,
	workspaceId: string,
): WorkspaceCacheSnapshot {
	return {
		page: queryClient.getQueryData<WorkspacePage>(
			workspacePageQueryKey(workspaceId),
		),
		workspace: queryClient.getQueryData<WorkspaceSummary>(
			workspaceQueryKey(workspaceId),
		),
		workspaces:
			queryClient.getQueryData<WorkspaceSummary[]>(workspacesQueryKey),
	};
}

export function restoreWorkspaceCacheSnapshot(
	queryClient: QueryClient,
	workspaceId: string,
	snapshot: WorkspaceCacheSnapshot | undefined,
) {
	if (!snapshot) {
		return;
	}

	restoreWorkspaceListCache(queryClient, snapshot.workspaces);

	if (snapshot.workspace) {
		queryClient.setQueryData(
			workspaceQueryKey(workspaceId),
			snapshot.workspace,
		);
	} else {
		queryClient.removeQueries({ queryKey: workspaceQueryKey(workspaceId) });
	}

	if (snapshot.page) {
		queryClient.setQueryData(workspacePageQueryKey(workspaceId), snapshot.page);
	} else {
		queryClient.removeQueries({ queryKey: workspacePageQueryKey(workspaceId) });
	}
}
