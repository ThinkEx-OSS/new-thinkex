import type { QueryClient } from "@tanstack/react-query";

import type {
	WorkspaceItemSummary,
	WorkspacePage,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";

export const workspacesQueryKey = ["workspaces"] as const;

export function workspaceQueryKey(workspaceId: string) {
	return ["workspaces", workspaceId] as const;
}

export function workspaceItemsQueryKey(workspaceId: string) {
	return ["workspaces", workspaceId, "items"] as const;
}

export function workspacePageQueryKey(workspaceId: string) {
	return ["workspaces", workspaceId, "page"] as const;
}

type WorkspaceListCacheMode = "upsert" | "update-existing" | "skip";

export function seedWorkspaceCaches(
	queryClient: QueryClient,
	input: {
		workspace: WorkspaceSummary;
		items?: WorkspaceItemSummary[];
	},
	options: {
		listMode?: WorkspaceListCacheMode;
	} = {},
) {
	const { workspace, items } = input;
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

	if (items) {
		queryClient.setQueryData(workspaceItemsQueryKey(workspace.id), items);
		queryClient.setQueryData(workspacePageQueryKey(workspace.id), {
			workspace,
			items,
		});
	}
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

export function upsertWorkspaceItemInCaches(
	queryClient: QueryClient,
	item: WorkspaceItemSummary,
) {
	const upsertItem = (items: WorkspaceItemSummary[] | undefined) => {
		if (!items) {
			return undefined;
		}

		if (items.some((current) => current.id === item.id)) {
			return items.map((current) => (current.id === item.id ? item : current));
		}

		return [...items, item];
	};

	queryClient.setQueryData<WorkspaceItemSummary[]>(
		workspaceItemsQueryKey(item.workspaceId),
		upsertItem,
	);
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(item.workspaceId),
		(current) =>
			current
				? {
						...current,
						items: upsertItem(current.items) ?? current.items,
					}
				: current,
	);
}

export function removeWorkspaceItemFromCaches(
	queryClient: QueryClient,
	input: { workspaceId: string; itemId: string },
) {
	const removeItem = (items: WorkspaceItemSummary[] | undefined) =>
		items?.filter((item) => item.id !== input.itemId);

	queryClient.setQueryData<WorkspaceItemSummary[]>(
		workspaceItemsQueryKey(input.workspaceId),
		removeItem,
	);
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(input.workspaceId),
		(current) =>
			current
				? {
						...current,
						items: removeItem(current.items) ?? current.items,
					}
				: current,
	);
}

export function removeWorkspaceCaches(
	queryClient: QueryClient,
	workspaceId: string,
) {
	queryClient.setQueryData<WorkspaceSummary[]>(workspacesQueryKey, (current) =>
		current?.filter((workspace) => workspace.id !== workspaceId),
	);
	removeWorkspaceDetailCaches(queryClient, workspaceId);
}

export function removeWorkspaceDetailCaches(
	queryClient: QueryClient,
	workspaceId: string,
) {
	queryClient.removeQueries({ queryKey: workspaceQueryKey(workspaceId) });
	queryClient.removeQueries({ queryKey: workspaceItemsQueryKey(workspaceId) });
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
