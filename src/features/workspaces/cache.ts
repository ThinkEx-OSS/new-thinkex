import type { QueryClient } from "@tanstack/react-query";

import type {
	CreateWorkspaceItemInput,
	MoveWorkspaceItemInput,
	WorkspaceItemSummary,
	WorkspacePage,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import {
	getAvailableWorkspaceItemName,
	getWorkspaceItemTypeMeta,
} from "#/features/workspaces/defaults";
import type { WorkspaceRealtimeEvent } from "#/features/workspaces/realtime/messages";

export const workspacesQueryKey = ["workspaces"] as const;

export function workspaceQueryKey(workspaceId: string) {
	return ["workspaces", workspaceId] as const;
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

export function createWorkspaceItemInPageCache(
	queryClient: QueryClient,
	input: CreateWorkspaceItemInput & { id: string },
) {
	const parentId = input.parentId ?? null;
	const now = new Date().toISOString();
	const previousPage = queryClient.getQueryData<WorkspacePage>(
		workspacePageQueryKey(input.workspaceId),
	);

	if (!previousPage) {
		return undefined;
	}

	const name = getAvailableWorkspaceItemNameInPage({
		items: previousPage.items,
		type: input.type,
		parentId,
		requestedName: input.name,
	});
	const item: WorkspaceItemSummary = {
		id: input.id,
		workspaceId: input.workspaceId,
		parentId,
		type: input.type,
		title: name,
		name,
		meta: getWorkspaceItemTypeMeta(input.type),
		color: null,
		metadataJson: {},
		sortOrder: getNextWorkspaceItemSortOrder(previousPage.items, parentId),
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
	};

	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(input.workspaceId),
		{
			...previousPage,
			items: [...previousPage.items, item].sort(compareWorkspaceItems),
		},
	);
}

export function moveWorkspaceItemInPageCache(
	queryClient: QueryClient,
	input: MoveWorkspaceItemInput,
) {
	const nextParentId = input.parentId ?? null;
	const previousPage = queryClient.getQueryData<WorkspacePage>(
		workspacePageQueryKey(input.workspaceId),
	);

	if (!previousPage) {
		return undefined;
	}

	const previousItem = previousPage.items.find(
		(item) => item.id === input.itemId,
	);

	if (!previousItem) {
		return undefined;
	}

	const name = getAvailableWorkspaceItemNameInPage({
		items: previousPage.items,
		type: previousItem.type,
		parentId: nextParentId,
		requestedName: previousItem.name,
		excludeItemId: previousItem.id,
	});

	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(input.workspaceId),
		{
			...previousPage,
			items: previousPage.items
				.map((item) =>
					item.id === input.itemId
						? {
								...item,
								parentId: nextParentId,
								name,
								title: name,
								sortOrder:
									input.sortOrder ??
									getNextWorkspaceItemSortOrder(
										previousPage.items.filter(
											(candidate) => candidate.id !== input.itemId,
										),
										nextParentId,
									),
								updatedAt: new Date().toISOString(),
							}
						: item,
				)
				.sort(compareWorkspaceItems),
		},
	);

	return previousItem;
}

export function removeWorkspaceItemsFromPageCache(
	queryClient: QueryClient,
	workspaceId: string,
	itemIds: string[],
) {
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(workspaceId),
		(current) =>
			current
				? {
						...current,
						items: current.items.filter((item) => !itemIds.includes(item.id)),
					}
				: current,
	);
}

export function restoreWorkspaceItemInPageCache(
	queryClient: QueryClient,
	item: WorkspaceItemSummary | undefined,
) {
	if (!item) {
		return;
	}

	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(item.workspaceId),
		(current) =>
			current
				? {
						...current,
						items: current.items
							.map((candidate) => (candidate.id === item.id ? item : candidate))
							.sort(compareWorkspaceItems),
					}
				: current,
	);
}

export function applyWorkspaceEventToCache(
	queryClient: QueryClient,
	event: WorkspaceRealtimeEvent,
) {
	switch (event.type) {
		case "workspace.item.created":
		case "workspace.item.renamed":
		case "workspace.item.moved":
		case "workspace.item.content.updated":
			upsertWorkspaceItemInPageCache(queryClient, event.payload.item, event);
			return;
		case "workspace.item.deleted":
			removeWorkspaceItemFromPageCache(queryClient, event);
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

function getNextWorkspaceItemSortOrder(
	items: WorkspaceItemSummary[],
	parentId: string | null,
) {
	const siblingSortOrders = items
		.filter((item) => item.parentId === parentId)
		.map((item) => item.sortOrder);

	return siblingSortOrders.length > 0
		? Math.max(...siblingSortOrders) + 1024
		: 1024;
}

function getAvailableWorkspaceItemNameInPage(input: {
	items: WorkspaceItemSummary[];
	type: WorkspaceItemSummary["type"];
	parentId: string | null;
	requestedName?: string;
	excludeItemId?: string;
}) {
	return getAvailableWorkspaceItemName({
		type: input.type,
		requestedName: input.requestedName,
		existingNames: input.items
			.filter(
				(item) =>
					item.parentId === input.parentId && item.id !== input.excludeItemId,
			)
			.map((item) => item.name),
	});
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
