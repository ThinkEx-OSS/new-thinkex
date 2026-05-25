import { and, asc, eq, inArray, isNull, max, ne, sql } from "drizzle-orm";

import { workspaceItems } from "#/db/schema";
import { createDbContext } from "#/db/server";
import type {
	CreateWorkspaceItemInput,
	DeleteWorkspaceItemInput,
	DeleteWorkspaceItemResult,
	MoveWorkspaceItemInput,
	MoveWorkspaceItemResult,
	ReorderWorkspaceItemsInput,
	ReorderWorkspaceItemsResult,
	UpdateWorkspaceItemInput,
	WorkspaceItemReorderRow,
	WorkspaceItemSummary,
	WorkspaceMutationActor,
} from "#/features/workspaces/contracts";
import { getAvailableWorkspaceItemName } from "#/features/workspaces/defaults";
import { scheduleWorkspaceEventBroadcast } from "#/features/workspaces/realtime/broadcast.server";
import { insertWorkspaceRealtimeEvent } from "#/features/workspaces/realtime/events.server";
import { mapWorkspaceItemRow } from "#/features/workspaces/server/mappers";
import { getCurrentUserWorkspaceMutationActor } from "#/features/workspaces/server/mutation-actor";
import { assertCanMutateWorkspace } from "#/features/workspaces/server/permissions";
import { WORKSPACE_ITEM_SORT_ORDER_STEP } from "#/features/workspaces/workspace-item-ordering";

type WorkspaceDb = Awaited<ReturnType<typeof createDbContext>>["db"];
type Transaction = Parameters<Parameters<WorkspaceDb["transaction"]>[0]>[0];
type WorkspaceItemRow = typeof workspaceItems.$inferSelect;

export async function createWorkspaceItemForCurrentUser(
	input: CreateWorkspaceItemInput,
): Promise<WorkspaceItemSummary> {
	return createWorkspaceItemForActor(
		await getCurrentUserWorkspaceMutationActor(),
		input,
	);
}

export async function createWorkspaceItemForActor(
	actor: WorkspaceMutationActor,
	input: CreateWorkspaceItemInput,
): Promise<WorkspaceItemSummary> {
	const userId = actor.userId;
	const dbContext = await createDbContext();
	const itemId = input.id ?? crypto.randomUUID();

	try {
		await assertCanMutateWorkspace(dbContext.db, {
			workspaceId: input.workspaceId,
			userId,
		});

		const result = await dbContext.db.transaction(async (tx) => {
			const parentId = input.parentId ?? null;

			await assertValidItemParent(tx, {
				workspaceId: input.workspaceId,
				parentId,
			});

			const name = await getAvailableItemName(tx, {
				workspaceId: input.workspaceId,
				parentId,
				requestedName: input.name,
				type: input.type,
			});
			const sortOrder = await getNextItemSortOrder(tx, {
				workspaceId: input.workspaceId,
				parentId,
				type: input.type,
			});
			const [createdItem] = await tx
				.insert(workspaceItems)
				.values({
					id: itemId,
					workspaceId: input.workspaceId,
					parentId,
					type: input.type,
					name,
					sortOrder,
					metadataJson: {},
					layoutJson: {},
					createdByUserId: userId,
					updatedByUserId: userId,
				})
				.returning();

			if (!createdItem) {
				throw new Error("Workspace item was not created.");
			}

			const mappedItem = mapWorkspaceItemRow(createdItem);
			const event = await insertWorkspaceRealtimeEvent(tx, {
				workspaceId: input.workspaceId,
				itemId: createdItem.id,
				actor,
				type: "workspace.item.created",
				payload: { item: mappedItem },
			});

			return {
				item: mappedItem,
				event,
			};
		});

		await scheduleWorkspaceEventBroadcast(result.event);

		return result.item;
	} finally {
		await dbContext.dispose();
	}
}

export async function updateWorkspaceItemForCurrentUser(
	input: UpdateWorkspaceItemInput,
): Promise<WorkspaceItemSummary> {
	return updateWorkspaceItemForActor(
		await getCurrentUserWorkspaceMutationActor(),
		input,
	);
}

export async function updateWorkspaceItemForActor(
	actor: WorkspaceMutationActor,
	input: UpdateWorkspaceItemInput,
): Promise<WorkspaceItemSummary> {
	const userId = actor.userId;
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, {
			workspaceId: input.workspaceId,
			userId,
		});

		const result = await dbContext.db.transaction(async (tx) => {
			const item = await getWorkspaceItemById(tx, {
				workspaceId: input.workspaceId,
				itemId: input.itemId,
			});

			if (!item) {
				throw new Error("Workspace item was not found.");
			}

			const name = await getAvailableItemName(tx, {
				workspaceId: input.workspaceId,
				parentId: item.parentId,
				requestedName: input.name,
				type: item.type,
				ignoreItemId: item.id,
			});

			const [updatedItem] = await tx
				.update(workspaceItems)
				.set({
					name,
					updatedByUserId: userId,
					updatedAt: sql`now()`,
				})
				.where(
					and(
						eq(workspaceItems.id, item.id),
						eq(workspaceItems.workspaceId, input.workspaceId),
						isNull(workspaceItems.deletedAt),
					),
				)
				.returning();

			if (!updatedItem) {
				throw new Error("Workspace item was not updated.");
			}

			const mappedItem = mapWorkspaceItemRow(updatedItem);
			const event = await insertWorkspaceRealtimeEvent(tx, {
				workspaceId: input.workspaceId,
				itemId: updatedItem.id,
				actor,
				type: "workspace.item.renamed",
				payload: { item: mappedItem },
			});

			return {
				item: mappedItem,
				event,
			};
		});

		await scheduleWorkspaceEventBroadcast(result.event);

		return result.item;
	} finally {
		await dbContext.dispose();
	}
}

export async function deleteWorkspaceItemForCurrentUser(
	input: DeleteWorkspaceItemInput,
): Promise<DeleteWorkspaceItemResult> {
	return deleteWorkspaceItemForActor(
		await getCurrentUserWorkspaceMutationActor(),
		input,
	);
}

export async function deleteWorkspaceItemForActor(
	actor: WorkspaceMutationActor,
	input: DeleteWorkspaceItemInput,
): Promise<DeleteWorkspaceItemResult> {
	const userId = actor.userId;
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, {
			workspaceId: input.workspaceId,
			userId,
		});

		const result = await dbContext.db.transaction(async (tx) => {
			const item = await getWorkspaceItemById(tx, {
				workspaceId: input.workspaceId,
				itemId: input.itemId,
			});

			if (!item) {
				throw new Error("Workspace item was not found.");
			}

			const directChildren = await getDirectChildItems(tx, {
				workspaceId: input.workspaceId,
				parentId: item.id,
			});

			let deletedItemIds: string[];
			let reparentedItems: WorkspaceItemSummary[] = [];

			if (item.type === "folder" && directChildren.length > 0) {
				if (!input.mode) {
					throw new Error("Choose what to do with this folder's items.");
				}

				if (input.mode === "folder-only") {
					reparentedItems = await moveChildrenToDeletedFolderParent(tx, {
						workspaceId: input.workspaceId,
						folder: item,
						children: directChildren,
						userId,
					});
					deletedItemIds = [item.id];
				} else {
					deletedItemIds = await listItemSubtreeIds(tx, {
						workspaceId: input.workspaceId,
						rootItemId: item.id,
					});
				}
			} else {
				deletedItemIds = [item.id];
			}

			await softDeleteItems(tx, {
				workspaceId: input.workspaceId,
				itemIds: deletedItemIds,
				userId,
			});

			const eventPayload = {
				deletedItemIds,
				reparentedItems,
			};
			const event = await insertWorkspaceRealtimeEvent(tx, {
				workspaceId: input.workspaceId,
				itemId: item.id,
				actor,
				type: "workspace.item.deleted",
				payload: eventPayload,
			});

			return {
				result: {
					workspaceId: input.workspaceId,
					itemId: item.id,
					deletedItemIds,
					reparentedItems,
				},
				event,
			};
		});

		await scheduleWorkspaceEventBroadcast(result.event);

		return result.result;
	} finally {
		await dbContext.dispose();
	}
}

export async function reorderWorkspaceItemsForCurrentUser(
	input: ReorderWorkspaceItemsInput,
): Promise<ReorderWorkspaceItemsResult> {
	return reorderWorkspaceItemsForActor(
		await getCurrentUserWorkspaceMutationActor({
			operationId: input.clientMutationId,
		}),
		input,
	);
}

export async function reorderWorkspaceItemsForActor(
	actor: WorkspaceMutationActor,
	input: ReorderWorkspaceItemsInput,
): Promise<ReorderWorkspaceItemsResult> {
	const userId = actor.userId;
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, {
			workspaceId: input.workspaceId,
			userId,
		});

		const result = await dbContext.db.transaction(async (tx) => {
			const siblings = await getReorderableSiblings(tx, input);
			assertCompleteSiblingOrder(input, siblings);

			const updatedItems: WorkspaceItemSummary[] = [];

			for (const [index, itemId] of input.orderedItemIds.entries()) {
				const [updatedItem] = await tx
					.update(workspaceItems)
					.set({
						sortOrder: (index + 1) * WORKSPACE_ITEM_SORT_ORDER_STEP,
						updatedByUserId: userId,
						updatedAt: sql`now()`,
					})
					.where(
						and(
							eq(workspaceItems.id, itemId),
							eq(workspaceItems.workspaceId, input.workspaceId),
							isNull(workspaceItems.deletedAt),
						),
					)
					.returning();

				if (!updatedItem) {
					throw new Error("Workspace item order could not be updated.");
				}

				updatedItems.push(mapWorkspaceItemRow(updatedItem));
			}

			const payload = {
				parentId: input.parentId,
				row: input.row,
				items: updatedItems,
				...(input.clientMutationId
					? { clientMutationId: input.clientMutationId }
					: {}),
			};
			const event = await insertWorkspaceRealtimeEvent(tx, {
				workspaceId: input.workspaceId,
				itemId: input.movedItemId,
				actor,
				type: "workspace.items.reordered",
				payload,
			});

			return {
				result: {
					workspaceId: input.workspaceId,
					parentId: input.parentId,
					row: input.row,
					items: updatedItems,
					...(input.clientMutationId
						? { clientMutationId: input.clientMutationId }
						: {}),
				},
				event,
			};
		});

		await scheduleWorkspaceEventBroadcast(result.event);

		return result.result;
	} finally {
		await dbContext.dispose();
	}
}

export async function moveWorkspaceItemForCurrentUser(
	input: MoveWorkspaceItemInput,
): Promise<MoveWorkspaceItemResult> {
	return moveWorkspaceItemForActor(
		await getCurrentUserWorkspaceMutationActor({
			operationId: input.clientMutationId,
		}),
		input,
	);
}

export async function moveWorkspaceItemForActor(
	actor: WorkspaceMutationActor,
	input: MoveWorkspaceItemInput,
): Promise<MoveWorkspaceItemResult> {
	const userId = actor.userId;
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, {
			workspaceId: input.workspaceId,
			userId,
		});

		const result = await dbContext.db.transaction(async (tx) => {
			const item = await getWorkspaceItemById(tx, {
				workspaceId: input.workspaceId,
				itemId: input.itemId,
			});

			if (!item) {
				throw new Error("Workspace item was not found.");
			}

			const targetParentId = input.targetParentId ?? null;

			await assertValidItemMove(tx, {
				workspaceId: input.workspaceId,
				item,
				targetParentId,
			});

			const sourceParentId = item.parentId;
			const row = getWorkspaceItemReorderRow(item);
			const sortOrder = await getNextItemSortOrder(tx, {
				workspaceId: input.workspaceId,
				parentId: targetParentId,
				type: item.type,
			});
			const name = await getAvailableItemName(tx, {
				workspaceId: input.workspaceId,
				parentId: targetParentId,
				requestedName: item.name,
				type: item.type,
				ignoreItemId: item.id,
			});
			const [updatedItem] = await tx
				.update(workspaceItems)
				.set({
					parentId: targetParentId,
					name,
					sortOrder,
					updatedByUserId: userId,
					updatedAt: sql`now()`,
				})
				.where(
					and(
						eq(workspaceItems.id, item.id),
						eq(workspaceItems.workspaceId, input.workspaceId),
						isNull(workspaceItems.deletedAt),
					),
				)
				.returning();

			if (!updatedItem) {
				throw new Error("Workspace item could not be moved.");
			}

			const [sourceItems, destinationItems] = await Promise.all([
				getReorderableSiblings(tx, {
					workspaceId: input.workspaceId,
					parentId: sourceParentId,
					row,
				}),
				getReorderableSiblings(tx, {
					workspaceId: input.workspaceId,
					parentId: targetParentId,
					row,
				}),
			]);
			const movedItem = mapWorkspaceItemRow(updatedItem);
			const payload = {
				item: movedItem,
				source: {
					parentId: sourceParentId,
					row,
					items: sourceItems.map(mapWorkspaceItemRow),
				},
				destination: {
					parentId: targetParentId,
					row,
					items: destinationItems.map(mapWorkspaceItemRow),
				},
				...(input.clientMutationId
					? { clientMutationId: input.clientMutationId }
					: {}),
			};
			const event = await insertWorkspaceRealtimeEvent(tx, {
				workspaceId: input.workspaceId,
				itemId: item.id,
				actor,
				type: "workspace.item.moved",
				payload,
			});

			return {
				result: {
					workspaceId: input.workspaceId,
					...payload,
				},
				event,
			};
		});

		await scheduleWorkspaceEventBroadcast(result.event);

		return result.result;
	} finally {
		await dbContext.dispose();
	}
}

async function assertValidItemParent(
	tx: Transaction,
	input: { workspaceId: string; parentId: string | null },
) {
	if (!input.parentId) {
		return;
	}

	const [parent] = await tx
		.select({ type: workspaceItems.type })
		.from(workspaceItems)
		.where(
			and(
				eq(workspaceItems.id, input.parentId),
				eq(workspaceItems.workspaceId, input.workspaceId),
				isNull(workspaceItems.deletedAt),
			),
		)
		.limit(1);

	if (!parent || parent.type !== "folder") {
		throw new Error("Items can only be created inside folders.");
	}
}

async function assertValidItemMove(
	tx: Transaction,
	input: {
		workspaceId: string;
		item: WorkspaceItemRow;
		targetParentId: string | null;
	},
) {
	if (input.item.parentId === input.targetParentId) {
		throw new Error("Workspace item is already in that location.");
	}

	if (!input.targetParentId) {
		return;
	}

	if (input.item.id === input.targetParentId) {
		throw new Error("A folder cannot be moved into itself.");
	}

	const [targetParent] = await tx
		.select({ id: workspaceItems.id, type: workspaceItems.type })
		.from(workspaceItems)
		.where(
			and(
				eq(workspaceItems.id, input.targetParentId),
				eq(workspaceItems.workspaceId, input.workspaceId),
				isNull(workspaceItems.deletedAt),
			),
		)
		.limit(1);

	if (!targetParent || targetParent.type !== "folder") {
		throw new Error("Items can only be moved into folders.");
	}

	if (input.item.type !== "folder") {
		return;
	}

	const descendantIds = await listItemSubtreeIds(tx, {
		workspaceId: input.workspaceId,
		rootItemId: input.item.id,
	});

	if (descendantIds.includes(input.targetParentId)) {
		throw new Error("A folder cannot be moved into its own descendant.");
	}
}

async function getAvailableItemName(
	tx: Transaction,
	input: {
		workspaceId: string;
		parentId: string | null;
		requestedName: string | undefined;
		type: CreateWorkspaceItemInput["type"];
		ignoreItemId?: string;
	},
) {
	const siblings = await tx
		.select({ id: workspaceItems.id, name: workspaceItems.name })
		.from(workspaceItems)
		.where(
			and(
				eq(workspaceItems.workspaceId, input.workspaceId),
				input.parentId
					? eq(workspaceItems.parentId, input.parentId)
					: isNull(workspaceItems.parentId),
				isNull(workspaceItems.deletedAt),
			),
		);
	return getAvailableWorkspaceItemName({
		type: input.type,
		requestedName: input.requestedName,
		existingNames: siblings
			.filter((item) => item.id !== input.ignoreItemId)
			.map((item) => item.name),
	});
}

async function getWorkspaceItemById(
	tx: Transaction,
	input: { workspaceId: string; itemId: string },
) {
	const [item] = await tx
		.select()
		.from(workspaceItems)
		.where(
			and(
				eq(workspaceItems.id, input.itemId),
				eq(workspaceItems.workspaceId, input.workspaceId),
				isNull(workspaceItems.deletedAt),
			),
		)
		.limit(1);

	return item;
}

function getWorkspaceItemReorderRow(
	item: Pick<WorkspaceItemRow, "type">,
): WorkspaceItemReorderRow {
	return item.type === "folder" ? "folder" : "item";
}

async function getReorderableSiblings(
	tx: Transaction,
	input: Pick<ReorderWorkspaceItemsInput, "workspaceId" | "parentId" | "row">,
) {
	return tx
		.select()
		.from(workspaceItems)
		.where(
			and(
				eq(workspaceItems.workspaceId, input.workspaceId),
				input.parentId
					? eq(workspaceItems.parentId, input.parentId)
					: isNull(workspaceItems.parentId),
				input.row === "folder"
					? eq(workspaceItems.type, "folder")
					: ne(workspaceItems.type, "folder"),
				isNull(workspaceItems.deletedAt),
			),
		)
		.orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.name));
}

function assertCompleteSiblingOrder(
	input: ReorderWorkspaceItemsInput,
	siblings: WorkspaceItemRow[],
) {
	const expectedIds = new Set(siblings.map((item) => item.id));
	const orderedIds = new Set(input.orderedItemIds);
	const hasMovedItem = expectedIds.has(input.movedItemId);
	const hasDuplicateIds = orderedIds.size !== input.orderedItemIds.length;
	const hasSameLength = expectedIds.size === input.orderedItemIds.length;
	const hasSameIds = input.orderedItemIds.every((itemId) =>
		expectedIds.has(itemId),
	);

	if (!hasMovedItem || hasDuplicateIds || !hasSameLength || !hasSameIds) {
		throw new Error("Workspace item order is stale.");
	}
}

async function getDirectChildItems(
	tx: Transaction,
	input: { workspaceId: string; parentId: string },
) {
	return tx
		.select()
		.from(workspaceItems)
		.where(
			and(
				eq(workspaceItems.workspaceId, input.workspaceId),
				eq(workspaceItems.parentId, input.parentId),
				isNull(workspaceItems.deletedAt),
			),
		)
		.orderBy(asc(workspaceItems.sortOrder), asc(workspaceItems.name));
}

async function moveChildrenToDeletedFolderParent(
	tx: Transaction,
	input: {
		workspaceId: string;
		folder: WorkspaceItemRow;
		children: WorkspaceItemRow[];
		userId: string;
	},
) {
	const siblings = await tx
		.select({
			id: workspaceItems.id,
			name: workspaceItems.name,
			sortOrder: workspaceItems.sortOrder,
		})
		.from(workspaceItems)
		.where(
			and(
				eq(workspaceItems.workspaceId, input.workspaceId),
				input.folder.parentId
					? eq(workspaceItems.parentId, input.folder.parentId)
					: isNull(workspaceItems.parentId),
				isNull(workspaceItems.deletedAt),
			),
		);
	const reparentedItems: WorkspaceItemSummary[] = [];
	const existingNames = siblings
		.filter((item) => item.id !== input.folder.id)
		.map((item) => item.name);
	let nextSortOrder =
		Math.max(0, ...siblings.map((item) => item.sortOrder)) +
		WORKSPACE_ITEM_SORT_ORDER_STEP;

	for (const child of input.children) {
		const name = getAvailableWorkspaceItemName({
			type: child.type,
			requestedName: child.name,
			existingNames,
		});
		const [updatedChild] = await tx
			.update(workspaceItems)
			.set({
				parentId: input.folder.parentId,
				name,
				sortOrder: nextSortOrder,
				updatedByUserId: input.userId,
				updatedAt: sql`now()`,
			})
			.where(
				and(
					eq(workspaceItems.id, child.id),
					eq(workspaceItems.workspaceId, input.workspaceId),
					isNull(workspaceItems.deletedAt),
				),
			)
			.returning();

		if (!updatedChild) {
			throw new Error("Folder items could not be moved.");
		}

		existingNames.push(name);
		nextSortOrder += WORKSPACE_ITEM_SORT_ORDER_STEP;
		reparentedItems.push(mapWorkspaceItemRow(updatedChild));
	}

	return reparentedItems;
}

async function listItemSubtreeIds(
	tx: Transaction,
	input: { workspaceId: string; rootItemId: string },
) {
	const itemIds = [input.rootItemId];
	let parentIds = [input.rootItemId];

	while (parentIds.length > 0) {
		const children = await tx
			.select({ id: workspaceItems.id })
			.from(workspaceItems)
			.where(
				and(
					eq(workspaceItems.workspaceId, input.workspaceId),
					inArray(workspaceItems.parentId, parentIds),
					isNull(workspaceItems.deletedAt),
				),
			);

		parentIds = children.map((item) => item.id);
		itemIds.push(...parentIds);
	}

	return itemIds;
}

async function softDeleteItems(
	tx: Transaction,
	input: { workspaceId: string; itemIds: string[]; userId: string },
) {
	if (input.itemIds.length === 0) {
		return;
	}

	await tx
		.update(workspaceItems)
		.set({
			deletedAt: sql`now()`,
			updatedByUserId: input.userId,
			updatedAt: sql`now()`,
		})
		.where(
			and(
				eq(workspaceItems.workspaceId, input.workspaceId),
				inArray(workspaceItems.id, input.itemIds),
				isNull(workspaceItems.deletedAt),
			),
		);
}

async function getNextItemSortOrder(
	tx: Transaction,
	input: {
		workspaceId: string;
		parentId: string | null;
		type: CreateWorkspaceItemInput["type"];
	},
) {
	const [row] = await tx
		.select({ sortOrder: max(workspaceItems.sortOrder) })
		.from(workspaceItems)
		.where(
			and(
				eq(workspaceItems.workspaceId, input.workspaceId),
				input.parentId
					? eq(workspaceItems.parentId, input.parentId)
					: isNull(workspaceItems.parentId),
				input.type === "folder"
					? eq(workspaceItems.type, "folder")
					: ne(workspaceItems.type, "folder"),
				isNull(workspaceItems.deletedAt),
			),
		);

	return (row?.sortOrder ?? 0) + WORKSPACE_ITEM_SORT_ORDER_STEP;
}
