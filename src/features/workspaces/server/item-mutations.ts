import { and, eq, isNull, max } from "drizzle-orm";

import { workspaceEvents, workspaceItems } from "#/db/schema";
import { createDbContext } from "#/db/server";
import type {
	CreateWorkspaceItemInput,
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
	},
) {
	const siblings = await tx
		.select({ name: workspaceItems.name })
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
		existingNames: siblings.map((item) => item.name),
	});
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
