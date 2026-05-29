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
	WORKSPACE_ITEM_SORT_STEP,
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
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(input.workspaceId),
		(current) =>
			current ? createWorkspaceItemInPage(current, input) : current,
	);
}

export function moveWorkspaceItemInPageCache(
	queryClient: QueryClient,
	input: MoveWorkspaceItemInput,
) {
	let previousItem: WorkspaceItemSummary | undefined;

	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(input.workspaceId),
		(current) => {
			if (!current) {
				return current;
			}

			const moveResult = moveWorkspaceItemInPage(current, input);

			if (!moveResult) {
				return current;
			}

			previousItem = moveResult.previousItem;
			return moveResult.page;
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
			current ? removeWorkspaceItemsFromPage(current, itemIds) : current,
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
		(current) => (current ? upsertWorkspaceItemInPage(current, item) : current),
	);
}

export function applyWorkspaceEventToCache(
	queryClient: QueryClient,
	event: WorkspaceRealtimeEvent,
) {
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(event.workspaceId),
		(current) =>
			current ? applyWorkspaceEventToPage(current, event) : current,
	);
}

function applyWorkspaceEventToPage(
	page: WorkspacePage,
	event: WorkspaceRealtimeEvent,
): WorkspacePage {
	switch (event.type) {
		case "workspace.item.created":
		case "workspace.item.renamed":
		case "workspace.item.moved":
		case "workspace.item.content.updated":
			return upsertWorkspaceItemInPage(
				page,
				event.payload.item,
				event.revision,
			);
		case "workspace.item.deleted":
			return removeWorkspaceItemsFromPage(
				page,
				event.payload.deletedItemIds,
				event.revision,
			);
	}
}

function createWorkspaceItemInPage(
	page: WorkspacePage,
	input: CreateWorkspaceItemInput & { id: string },
): WorkspacePage {
	const parentId = input.parentId ?? null;
	const now = new Date().toISOString();
	const name = getAvailableWorkspaceItemNameInPage({
		items: page.items,
		type: input.type,
		parentId,
		requestedName: input.name,
	});

	return upsertWorkspaceItemInPage(page, {
		id: input.id,
		workspaceId: input.workspaceId,
		parentId,
		type: input.type,
		title: name,
		name,
		meta: getWorkspaceItemTypeMeta(input.type),
		color: null,
		metadataJson: {},
		sortOrder: getNextWorkspaceItemSortOrder(page.items, parentId),
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
	});
}

function moveWorkspaceItemInPage(
	page: WorkspacePage,
	input: MoveWorkspaceItemInput,
): { page: WorkspacePage; previousItem: WorkspaceItemSummary } | null {
	const previousItem = page.items.find((item) => item.id === input.itemId);

	if (!previousItem) {
		return null;
	}

	const nextParentId = input.parentId ?? null;
	const name = getAvailableWorkspaceItemNameInPage({
		items: page.items,
		type: previousItem.type,
		parentId: nextParentId,
		requestedName: previousItem.name,
		excludeItemId: previousItem.id,
	});

	return {
		previousItem,
		page: upsertWorkspaceItemInPage(page, {
			...previousItem,
			parentId: nextParentId,
			name,
			title: name,
			sortOrder:
				input.sortOrder ??
				getNextWorkspaceItemSortOrder(
					page.items.filter((candidate) => candidate.id !== input.itemId),
					nextParentId,
				),
			updatedAt: new Date().toISOString(),
		}),
	};
}

function upsertWorkspaceItemInPage(
	page: WorkspacePage,
	item: WorkspaceItemSummary,
	revision = page.revision,
): WorkspacePage {
	const items = page.items.some((candidate) => candidate.id === item.id)
		? page.items.map((candidate) =>
				candidate.id === item.id ? item : candidate,
			)
		: [...page.items, item];

	return {
		...page,
		revision: Math.max(page.revision, revision),
		items: items.sort(compareWorkspaceItems),
	};
}

function removeWorkspaceItemsFromPage(
	page: WorkspacePage,
	itemIds: string[],
	revision = page.revision,
): WorkspacePage {
	const deletedIds = new Set(itemIds);

	return {
		...page,
		revision: Math.max(page.revision, revision),
		items: page.items.filter((item) => !deletedIds.has(item.id)),
	};
}

function compareWorkspaceItems(
	left: WorkspaceItemSummary,
	right: WorkspaceItemSummary,
) {
	return (
		(left.parentId ?? "").localeCompare(right.parentId ?? "") ||
		left.sortOrder - right.sortOrder ||
		left.name.localeCompare(right.name)
	);
}

function getNextWorkspaceItemSortOrder(
	items: WorkspaceItemSummary[],
	parentId: string | null,
) {
	const siblingSortOrders = items
		.filter((item) => item.parentId === parentId)
		.map((item) => item.sortOrder);

	return (
		(siblingSortOrders.length > 0 ? Math.max(...siblingSortOrders) : 0) +
		WORKSPACE_ITEM_SORT_STEP
	);
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
