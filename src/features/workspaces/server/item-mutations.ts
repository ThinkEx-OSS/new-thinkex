import { and, asc, eq, inArray, isNull, max } from "drizzle-orm";

import { workspaceEvents, workspaceItems } from "#/db/schema";
import { createDbContext } from "#/db/server";
import type {
	CreateWorkspaceItemInput,
	DeleteWorkspaceItemInput,
	DeleteWorkspaceItemResult,
	UpdateWorkspaceItemInput,
	WorkspaceItemSummary,
} from "#/features/workspaces/contracts";
import { getAvailableWorkspaceItemName } from "#/features/workspaces/defaults";
import { scheduleWorkspaceEventBroadcast } from "#/features/workspaces/realtime/broadcast.server";
import type { WorkspaceRealtimeEvent } from "#/features/workspaces/realtime/messages";
import { mapWorkspaceItemRow } from "#/features/workspaces/server/mappers";
import {
	assertCanMutateWorkspace,
	getCurrentUserId,
} from "#/features/workspaces/server/permissions";

type WorkspaceDb = Awaited<ReturnType<typeof createDbContext>>["db"];
type Transaction = Parameters<Parameters<WorkspaceDb["transaction"]>[0]>[0];
type WorkspaceItemRow = typeof workspaceItems.$inferSelect;

export async function createWorkspaceItemForCurrentUser(
	input: CreateWorkspaceItemInput,
): Promise<WorkspaceItemSummary> {
	const userId = await getCurrentUserId();
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
			const eventRow = await insertWorkspaceEvent(tx, {
				workspaceId: input.workspaceId,
				itemId: createdItem.id,
				actorUserId: userId,
				eventType: "workspace.item.created",
				payloadJson: { item: mappedItem },
			});

			const event: WorkspaceRealtimeEvent = {
				id: eventRow.id,
				type: "workspace.item.created",
				workspaceId: input.workspaceId,
				itemId: createdItem.id,
				actorUserId: userId,
				createdAt: eventRow.createdAt.toISOString(),
				payload: { item: mappedItem },
			};

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
	const userId = await getCurrentUserId();
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
			const eventRow = await insertWorkspaceEvent(tx, {
				workspaceId: input.workspaceId,
				itemId: updatedItem.id,
				actorUserId: userId,
				eventType: "workspace.item.renamed",
				payloadJson: { item: mappedItem },
			});

			const event: WorkspaceRealtimeEvent = {
				id: eventRow.id,
				type: "workspace.item.renamed",
				workspaceId: input.workspaceId,
				itemId: updatedItem.id,
				actorUserId: userId,
				createdAt: eventRow.createdAt.toISOString(),
				payload: { item: mappedItem },
			};

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
	const userId = await getCurrentUserId();
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
			const eventRow = await insertWorkspaceEvent(tx, {
				workspaceId: input.workspaceId,
				itemId: item.id,
				actorUserId: userId,
				eventType: "workspace.item.deleted",
				payloadJson: eventPayload,
			});

			const event: WorkspaceRealtimeEvent = {
				id: eventRow.id,
				type: "workspace.item.deleted",
				workspaceId: input.workspaceId,
				itemId: item.id,
				actorUserId: userId,
				createdAt: eventRow.createdAt.toISOString(),
				payload: eventPayload,
			};

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
		Math.max(0, ...siblings.map((item) => item.sortOrder)) + 1000;

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
		nextSortOrder += 1000;
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
			deletedAt: new Date(),
			updatedByUserId: input.userId,
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
	input: { workspaceId: string; parentId: string | null },
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
				isNull(workspaceItems.deletedAt),
			),
		);

	return (row?.sortOrder ?? 0) + 1000;
}

async function insertWorkspaceEvent(
	tx: Transaction,
	input: {
		workspaceId: string;
		itemId: string;
		actorUserId: string;
		eventType: WorkspaceRealtimeEvent["type"];
		payloadJson: Record<string, unknown>;
	},
) {
	const [event] = await tx
		.insert(workspaceEvents)
		.values({
			id: crypto.randomUUID(),
			workspaceId: input.workspaceId,
			itemId: input.itemId,
			actorType: "user",
			actorUserId: input.actorUserId,
			eventType: input.eventType,
			payloadJson: input.payloadJson,
		})
		.returning({
			id: workspaceEvents.id,
			createdAt: workspaceEvents.createdAt,
		});

	if (!event) {
		throw new Error("Workspace event was not created.");
	}

	return event;
}
