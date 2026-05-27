import { createDbContext } from "#/db/server";
import type {
	CreateWorkspaceItemInput,
	DeleteWorkspaceItemInput,
	MoveWorkspaceItemInput,
	RenameWorkspaceItemInput,
	WorkspaceItemSummary,
	WorkspacePage,
} from "#/features/workspaces/contracts";
import type { WorkspaceCommandResult } from "#/features/workspaces/realtime/messages";
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

interface DeleteWorkspaceKernelItemResult {
	id: string;
	deletedItemIds: string[];
}

interface DeleteWorkspaceItemResult {
	id: string;
	workspaceId: string;
	deletedItemIds: string[];
}

interface WorkspaceKernelClient {
	getPage(): Promise<{
		workspaceId: string;
		items: WorkspaceItemSummary[];
		revision: number;
	}>;
	listItems(input?: {
		parentId?: string | null;
		limit?: number;
	}): Promise<WorkspaceItemSummary[]>;
	createItem(input: {
		id?: string;
		parentId?: string | null;
		type: CreateWorkspaceItemInput["type"];
		name?: string;
		actorUserId?: string | null;
		clientMutationId?: string | null;
	}): Promise<WorkspaceCommandResult<WorkspaceItemSummary>>;
	renameItem(input: {
		itemId: string;
		name: string;
		actorUserId?: string | null;
		clientMutationId?: string | null;
	}): Promise<WorkspaceCommandResult<WorkspaceItemSummary>>;
	moveItem(input: {
		itemId: string;
		parentId?: string | null;
		sortOrder?: number;
		actorUserId?: string | null;
		clientMutationId?: string | null;
	}): Promise<WorkspaceCommandResult<WorkspaceItemSummary>>;
	deleteItem(input: {
		itemId: string;
		actorUserId?: string | null;
		clientMutationId?: string | null;
	}): Promise<WorkspaceCommandResult<DeleteWorkspaceKernelItemResult>>;
	readItem(input: {
		itemId: string;
	}): Promise<{ item: WorkspaceItemSummary; content: string | null }>;
	writeItem(input: {
		itemId: string;
		content: string;
		actorUserId?: string | null;
		clientMutationId?: string | null;
	}): Promise<WorkspaceCommandResult<WorkspaceItemSummary>>;
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
			revision: page.revision,
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
): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);

		return await kernel.createItem({
			id: input.id,
			parentId: input.parentId ?? null,
			type: input.type,
			name: input.name,
			actorUserId: input.userId,
			clientMutationId: input.clientMutationId ?? null,
		});
	} finally {
		await dbContext.dispose();
	}
}

export async function renameWorkspaceKernelItem(
	input: RenameWorkspaceItemInput & { userId: string },
): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);

		return await kernel.renameItem({
			itemId: input.itemId,
			name: input.name,
			actorUserId: input.userId,
			clientMutationId: input.clientMutationId ?? null,
		});
	} finally {
		await dbContext.dispose();
	}
}

export async function moveWorkspaceKernelItem(
	input: MoveWorkspaceItemInput & { userId: string },
): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);

		return await kernel.moveItem({
			itemId: input.itemId,
			parentId: input.parentId ?? null,
			sortOrder: input.sortOrder,
			actorUserId: input.userId,
			clientMutationId: input.clientMutationId ?? null,
		});
	} finally {
		await dbContext.dispose();
	}
}

export async function deleteWorkspaceKernelItem(
	input: DeleteWorkspaceItemInput & { userId: string },
): Promise<WorkspaceCommandResult<DeleteWorkspaceItemResult>> {
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);
		const command = await kernel.deleteItem({
			itemId: input.itemId,
			actorUserId: input.userId,
			clientMutationId: input.clientMutationId ?? null,
		});

		return {
			...command,
			result: {
				...command.result,
				workspaceId: input.workspaceId,
			},
		};
	} finally {
		await dbContext.dispose();
	}
}

async function getWorkspaceKernel(workspaceId: string) {
	const { env } = await import("cloudflare:workers");
	const workspaceKernelNamespace = env.WorkspaceKernel as unknown as {
		getByName(name: string): WorkspaceKernelClient;
	};

	return workspaceKernelNamespace.getByName(workspaceId);
}
