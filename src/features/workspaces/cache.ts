import type { QueryClient } from "@tanstack/react-query";

import type {
	WorkspaceItemSummary,
	WorkspacePage,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import type { WorkspaceRealtimeEvent } from "#/features/workspaces/realtime/messages";

export const workspacesQueryKey = ["workspaces"] as const;

export function workspaceQueryKey(workspaceId: string) {
	return ["workspaces", workspaceId] as const;
}

export function workspacePageQueryKey(workspaceId: string) {
	return ["workspaces", workspaceId, "page"] as const;
}

export function workspaceItemContentQueryKey(
	workspaceId: string,
	itemId: string,
) {
	return ["workspaces", workspaceId, "items", itemId, "content"] as const;
}

interface WorkspaceItemContentResult {
	item: WorkspaceItemSummary;
	content: string | null;
}

type WorkspaceListCacheMode = "upsert" | "update-existing" | "skip";

export function seedWorkspaceCaches(
	queryClient: QueryClient,
	input: {
		workspace: WorkspaceSummary;
		items?: WorkspaceItemSummary[];
		revision?: number;
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
		queryClient.setQueryData(workspacePageQueryKey(workspace.id), {
			workspace,
			items,
			revision: input.revision ?? 0,
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
	queryClient.removeQueries({ queryKey: workspacePageQueryKey(workspaceId) });
}

export function applyWorkspaceEventToCache(
	queryClient: QueryClient,
	event: WorkspaceRealtimeEvent,
	options: {
		content?: string | null;
		invalidateRemoteContent?: boolean;
	} = {},
) {
	switch (event.type) {
		case "workspace.item.created":
		case "workspace.item.renamed":
		case "workspace.item.moved":
			upsertWorkspaceItemInPageCache(queryClient, event.payload.item, event);
			return;
		case "workspace.item.deleted":
			removeWorkspaceItemFromPageCache(queryClient, event);
			return;
		case "workspace.item.content.updated":
			upsertWorkspaceItemInPageCache(queryClient, event.payload.item, event);
			if (options.content !== undefined) {
				queryClient.setQueryData<WorkspaceItemContentResult>(
					workspaceItemContentQueryKey(
						event.workspaceId,
						event.payload.item.id,
					),
					{
						item: event.payload.item,
						content: options.content,
					},
				);
				return;
			}
			if (options.invalidateRemoteContent ?? true) {
				void queryClient.invalidateQueries({
					queryKey: workspaceItemContentQueryKey(
						event.workspaceId,
						event.payload.item.id,
					),
				});
			}
			return;
	}
}

function upsertWorkspaceItemInPageCache(
	queryClient: QueryClient,
	item: WorkspaceItemSummary,
	event: WorkspaceRealtimeEvent,
) {
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(event.workspaceId),
		(current) => {
			if (!current) {
				return current;
			}

			const nextItems = current.items.some(
				(candidate) => candidate.id === item.id,
			)
				? current.items.map((candidate) =>
						candidate.id === item.id ? item : candidate,
					)
				: [...current.items, item];

			return {
				...current,
				revision: Math.max(current.revision, event.revision),
				items: nextItems.sort(compareWorkspaceItems),
			};
		},
	);
}

function removeWorkspaceItemFromPageCache(
	queryClient: QueryClient,
	event: Extract<WorkspaceRealtimeEvent, { type: "workspace.item.deleted" }>,
) {
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(event.workspaceId),
		(current) => {
			if (!current) {
				return current;
			}

			const deletedIds = new Set(event.payload.deletedItemIds);

			return {
				...current,
				revision: Math.max(current.revision, event.revision),
				items: current.items.filter((item) => !deletedIds.has(item.id)),
			};
		},
	);
}

function compareWorkspaceItems(
	left: WorkspaceItemSummary,
	right: WorkspaceItemSummary,
) {
	const parentDelta = (left.parentId ?? "").localeCompare(right.parentId ?? "");

	if (parentDelta !== 0) {
		return parentDelta;
	}

	const sortDelta = left.sortOrder - right.sortOrder;

	if (sortDelta !== 0) {
		return sortDelta;
	}

	return left.name.localeCompare(right.name);
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
