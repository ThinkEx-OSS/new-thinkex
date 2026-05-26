import { type Agent, getAgentByName } from "agents";

import { createDbContext } from "#/db/server";
import type {
	CreateWorkspaceItemInput,
	DeleteWorkspaceItemInput,
	MoveWorkspaceItemInput,
	ReadWorkspaceItemInput,
	RenameWorkspaceItemInput,
	WorkspaceItemSummary,
	WorkspacePage,
	WriteWorkspaceItemInput,
} from "#/features/workspaces/contracts";
import { scheduleWorkspaceEventBroadcast } from "#/features/workspaces/realtime/broadcast.server";
import {
	assertCanMutateWorkspace,
	assertCanReadWorkspace,
} from "#/features/workspaces/server/permissions";

export interface ListWorkspaceKernelItemsInput {
	workspaceId: string;
	userId: string;
	parentId?: string | null;
	limit?: number;
}

export interface ListWorkspaceKernelItemsResult {
	workspaceId: string;
	filter: {
		parentId: string | null;
	};
	totalItems: number;
	matchingItems: number;
	returnedItems: WorkspaceKernelItemSummary[];
}

export type WorkspaceKernelItemSummary = Pick<
	WorkspaceItemSummary,
	| "id"
	| "parentId"
	| "type"
	| "name"
	| "meta"
	| "color"
	| "sortOrder"
	| "updatedAt"
>;

interface WorkspaceKernelClient {
	getPage(): Promise<{ workspaceId: string; items: WorkspaceItemSummary[] }>;
	listItems(input?: {
		parentId?: string | null;
		limit?: number;
	}): Promise<WorkspaceItemSummary[]>;
	createItem(input: {
		parentId?: string | null;
		type: CreateWorkspaceItemInput["type"];
		name?: string;
	}): Promise<WorkspaceItemSummary>;
	renameItem(input: {
		itemId: string;
		name: string;
	}): Promise<WorkspaceItemSummary>;
	moveItem(input: {
		itemId: string;
		parentId?: string | null;
		sortOrder?: number;
	}): Promise<WorkspaceItemSummary>;
	deleteItem(input: { itemId: string }): Promise<{ id: string }>;
	readItem(input: {
		itemId: string;
	}): Promise<{ item: WorkspaceItemSummary; content: string | null }>;
	writeItem(input: {
		itemId: string;
		content: string;
	}): Promise<WorkspaceItemSummary>;
}

export async function getWorkspaceKernelPage(input: {
	workspaceId: string;
	userId: string;
	workspace: WorkspacePage["workspace"];
}): Promise<WorkspacePage> {
	const dbContext = await createDbContext();

	try {
		await assertCanReadWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);
		const page = await kernel.getPage();

		return {
			workspace: input.workspace,
			items: page.items,
		};
	} finally {
		await dbContext.dispose();
	}
}

export async function listWorkspaceKernelItems({
	workspaceId,
	userId,
	parentId,
	limit = 80,
}: ListWorkspaceKernelItemsInput): Promise<ListWorkspaceKernelItemsResult> {
	const dbContext = await createDbContext();

	try {
		await assertCanReadWorkspace(dbContext.db, { workspaceId, userId });
		const kernel = await getWorkspaceKernel(workspaceId);
		const returnedItems = (
			await kernel.listItems({ parentId: parentId ?? null, limit })
		).map((item) => ({
			id: item.id,
			parentId: item.parentId,
			type: item.type,
			name: item.name,
			meta: item.meta,
			color: item.color,
			sortOrder: item.sortOrder,
			updatedAt: item.updatedAt,
		}));
		const page = await kernel.getPage();
		const matchingItems = page.items.filter(
			(item) => item.parentId === (parentId ?? null),
		);

		return {
			workspaceId,
			filter: { parentId: parentId ?? null },
			totalItems: page.items.length,
			matchingItems: matchingItems.length,
			returnedItems,
		};
	} finally {
		await dbContext.dispose();
	}
}

export async function createWorkspaceKernelItem(
	input: CreateWorkspaceItemInput & { userId: string },
): Promise<WorkspaceItemSummary> {
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);

		const item = await kernel.createItem({
			parentId: input.parentId ?? null,
			type: input.type,
			name: input.name,
		});

		void scheduleWorkspaceEventBroadcast({
			id: crypto.randomUUID(),
			type: "workspace.item.created",
			workspaceId: input.workspaceId,
			actorUserId: input.userId,
			createdAt: new Date().toISOString(),
			payload: { itemId: item.id },
		});

		return item;
	} finally {
		await dbContext.dispose();
	}
}

export async function readWorkspaceKernelItem(
	input: ReadWorkspaceItemInput & { userId: string },
) {
	const dbContext = await createDbContext();

	try {
		await assertCanReadWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);

		return await kernel.readItem({ itemId: input.itemId });
	} finally {
		await dbContext.dispose();
	}
}

export async function renameWorkspaceKernelItem(
	input: RenameWorkspaceItemInput & { userId: string },
): Promise<WorkspaceItemSummary> {
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);

		const item = await kernel.renameItem({
			itemId: input.itemId,
			name: input.name,
		});

		void scheduleWorkspaceEventBroadcast({
			id: crypto.randomUUID(),
			type: "workspace.item.renamed",
			workspaceId: input.workspaceId,
			actorUserId: input.userId,
			createdAt: new Date().toISOString(),
			payload: { itemId: item.id },
		});

		return item;
	} finally {
		await dbContext.dispose();
	}
}

export async function moveWorkspaceKernelItem(
	input: MoveWorkspaceItemInput & { userId: string },
): Promise<WorkspaceItemSummary> {
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);

		const item = await kernel.moveItem({
			itemId: input.itemId,
			parentId: input.parentId ?? null,
			sortOrder: input.sortOrder,
		});

		void scheduleWorkspaceEventBroadcast({
			id: crypto.randomUUID(),
			type: "workspace.item.moved",
			workspaceId: input.workspaceId,
			actorUserId: input.userId,
			createdAt: new Date().toISOString(),
			payload: {
				itemId: item.id,
				parentId: item.parentId,
				sortOrder: item.sortOrder,
			},
		});

		return item;
	} finally {
		await dbContext.dispose();
	}
}

export async function deleteWorkspaceKernelItem(
	input: DeleteWorkspaceItemInput & { userId: string },
): Promise<{ id: string; workspaceId: string }> {
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);
		const result = await kernel.deleteItem({ itemId: input.itemId });

		void scheduleWorkspaceEventBroadcast({
			id: crypto.randomUUID(),
			type: "workspace.item.deleted",
			workspaceId: input.workspaceId,
			actorUserId: input.userId,
			createdAt: new Date().toISOString(),
			payload: { itemId: result.id },
		});

		return {
			...result,
			workspaceId: input.workspaceId,
		};
	} finally {
		await dbContext.dispose();
	}
}

export async function writeWorkspaceKernelItem(
	input: WriteWorkspaceItemInput & { userId: string },
): Promise<WorkspaceItemSummary> {
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);

		const item = await kernel.writeItem({
			itemId: input.itemId,
			content: input.content,
		});

		void scheduleWorkspaceEventBroadcast({
			id: crypto.randomUUID(),
			type: "workspace.item.content.updated",
			workspaceId: input.workspaceId,
			actorUserId: input.userId,
			createdAt: new Date().toISOString(),
			payload: { itemId: item.id },
		});

		return item;
	} finally {
		await dbContext.dispose();
	}
}

async function getWorkspaceKernel(workspaceId: string) {
	const { env } = await import("cloudflare:workers");

	return (await getAgentByName(
		env.WorkspaceKernel as unknown as DurableObjectNamespace<Agent<Env>>,
		workspaceId,
	)) as unknown as WorkspaceKernelClient;
}
