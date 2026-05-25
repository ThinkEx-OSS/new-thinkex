import type { QueryClient } from "@tanstack/react-query";

import type {
	MoveWorkspaceItemInput,
	MoveWorkspaceItemResult,
	ReorderWorkspaceItemsResult,
	WorkspaceItemSummary,
	WorkspacePage,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import {
	isWorkspaceItemInOrderRow,
	WORKSPACE_ITEM_SORT_ORDER_STEP,
} from "#/features/workspaces/workspace-item-ordering";

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
	removeWorkspaceItemsFromCaches(queryClient, {
		workspaceId: input.workspaceId,
		itemIds: [input.itemId],
	});
}

export function removeWorkspaceItemsFromCaches(
	queryClient: QueryClient,
	input: { workspaceId: string; itemIds: string[] },
) {
	const itemIds = new Set(input.itemIds);
	const removeItem = (items: WorkspaceItemSummary[] | undefined) =>
		items?.filter((item) => !itemIds.has(item.id));

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

export function applyWorkspaceItemDeletionInCaches(
	queryClient: QueryClient,
	input: {
		workspaceId: string;
		deletedItemIds: string[];
		reparentedItems: WorkspaceItemSummary[];
	},
) {
	removeWorkspaceItemsFromCaches(queryClient, {
		workspaceId: input.workspaceId,
		itemIds: input.deletedItemIds,
	});

	for (const item of input.reparentedItems) {
		upsertWorkspaceItemInCaches(queryClient, item);
	}
}

export function applyWorkspaceItemReorderInCaches(
	queryClient: QueryClient,
	input: ReorderWorkspaceItemsResult,
) {
	const updatedItemsById = new Map(input.items.map((item) => [item.id, item]));
	const applyReorder = (items: WorkspaceItemSummary[] | undefined) =>
		items?.map((item) => {
			const updatedItem = updatedItemsById.get(item.id);

			if (
				updatedItem &&
				isWorkspaceItemInOrderRow(item, {
					parentId: input.parentId,
					row: input.row,
				})
			) {
				return updatedItem;
			}

			return item;
		});

	queryClient.setQueryData<WorkspaceItemSummary[]>(
		workspaceItemsQueryKey(input.workspaceId),
		applyReorder,
	);
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(input.workspaceId),
		(current) =>
			current
				? {
						...current,
						items: applyReorder(current.items) ?? current.items,
					}
				: current,
	);
}

export function applyWorkspaceItemMoveInCaches(
	queryClient: QueryClient,
	input: MoveWorkspaceItemResult,
) {
	const sourceItemsById = new Map(
		input.source.items.map((item) => [item.id, item]),
	);
	const destinationItemsById = new Map(
		input.destination.items.map((item) => [item.id, item]),
	);
	const applyMove = (items: WorkspaceItemSummary[] | undefined) =>
		items?.map((item) => {
			if (item.id === input.item.id) {
				return input.item;
			}

			if (
				isWorkspaceItemInOrderRow(item, {
					parentId: input.source.parentId,
					row: input.source.row,
				})
			) {
				return sourceItemsById.get(item.id) ?? item;
			}

			if (
				isWorkspaceItemInOrderRow(item, {
					parentId: input.destination.parentId,
					row: input.destination.row,
				})
			) {
				return destinationItemsById.get(item.id) ?? item;
			}

			return item;
		});

	queryClient.setQueryData<WorkspaceItemSummary[]>(
		workspaceItemsQueryKey(input.workspaceId),
		applyMove,
	);
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(input.workspaceId),
		(current) =>
			current
				? {
						...current,
						items: applyMove(current.items) ?? current.items,
					}
				: current,
	);
}

export function optimisticallyMoveWorkspaceItemInCaches(
	queryClient: QueryClient,
	input: MoveWorkspaceItemInput,
) {
	const applyOptimisticMove = (items: WorkspaceItemSummary[] | undefined) => {
		if (!items) {
			return undefined;
		}

		const item = items.find((current) => current.id === input.itemId);

		if (!item || item.parentId === input.targetParentId) {
			return items;
		}

		const nextSortOrder =
			Math.max(
				0,
				...items
					.filter(
						(current) =>
							current.id !== item.id &&
							isWorkspaceItemInOrderRow(current, {
								parentId: input.targetParentId,
								row: item.type === "folder" ? "folder" : "item",
							}),
					)
					.map((current) => current.sortOrder),
			) + WORKSPACE_ITEM_SORT_ORDER_STEP;
		const movedItem: WorkspaceItemSummary = {
			...item,
			parentId: input.targetParentId,
			sortOrder: nextSortOrder,
			updatedAt: new Date().toISOString(),
		};

		return items.map((current) =>
			current.id === input.itemId ? movedItem : current,
		);
	};

	queryClient.setQueryData<WorkspaceItemSummary[]>(
		workspaceItemsQueryKey(input.workspaceId),
		applyOptimisticMove,
	);
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(input.workspaceId),
		(current) =>
			current
				? {
						...current,
						items: applyOptimisticMove(current.items) ?? current.items,
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
