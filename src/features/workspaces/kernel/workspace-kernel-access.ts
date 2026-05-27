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
	path?: string;
	recursive?: boolean;
	limit?: number;
}

export interface ListWorkspaceKernelItemsResult {
	path: string;
	count: number;
	more: boolean;
	entries: string[];
}

interface WorkspaceKernelTree {
	childrenByParentId: Map<string | null, WorkspaceItemSummary[]>;
}

interface WorkspaceKernelListEntries {
	entries: string[];
	truncated: boolean;
}

interface WorkspaceKernelCwd {
	path: string;
	parentId: string | null;
}

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
	path = "/",
	recursive = false,
	limit,
}: ListWorkspaceKernelItemsInput): Promise<ListWorkspaceKernelItemsResult> {
	const dbContext = await createDbContext();

	try {
		await assertCanReadWorkspace(dbContext.db, { workspaceId, userId });
		const kernel = await getWorkspaceKernel(workspaceId);
		const page = await kernel.getPage();
		const tree = buildWorkspaceKernelTree(page.items);
		const cwd = resolveWorkspaceKernelCwd(path, tree);
		const boundedLimit = clampWorkspaceListLimit(limit);
		const listing = collectWorkspaceKernelListEntries({
			parentId: cwd.parentId,
			recursive,
			limit: boundedLimit,
			childrenByParentId: tree.childrenByParentId,
		});

		return {
			path: cwd.path,
			count: listing.entries.length,
			more: listing.truncated,
			entries: listing.entries,
		};
	} finally {
		await dbContext.dispose();
	}
}

function buildWorkspaceKernelTree(
	items: WorkspaceItemSummary[],
): WorkspaceKernelTree {
	const childrenByParentId = new Map<string | null, WorkspaceItemSummary[]>();

	for (const item of items) {
		const children = childrenByParentId.get(item.parentId) ?? [];
		children.push(item);
		childrenByParentId.set(item.parentId, children);
	}

	for (const children of childrenByParentId.values()) {
		children.sort(compareWorkspaceKernelItems);
	}

	return {
		childrenByParentId,
	};
}

function resolveWorkspaceKernelCwd(
	path: string,
	tree: WorkspaceKernelTree,
): WorkspaceKernelCwd {
	const normalizedPath = normalizeWorkspacePath(path);

	if (normalizedPath === "/") {
		return {
			path: "/",
			parentId: null,
		};
	}

	const item = getWorkspaceItemByPath(normalizedPath, tree);

	if (!item) {
		throw new Error("Workspace path not found.");
	}

	if (item.type !== "folder") {
		throw new Error("Workspace path is not a folder.");
	}

	return {
		path: normalizedPath,
		parentId: item.id,
	};
}

function collectWorkspaceKernelListEntries({
	parentId,
	recursive,
	limit,
	childrenByParentId,
}: {
	parentId: string | null;
	recursive: boolean;
	limit: number;
	childrenByParentId: Map<string | null, WorkspaceItemSummary[]>;
}): WorkspaceKernelListEntries {
	const entries: string[] = [];
	const visitedIds = new Set<string>();
	let truncated = false;

	const visit = (
		currentParentId: string | null,
		relativeParentPath: string,
	): boolean => {
		for (const child of childrenByParentId.get(currentParentId) ?? []) {
			if (visitedIds.has(child.id)) {
				continue;
			}

			visitedIds.add(child.id);

			const relativePath = joinWorkspacePathSegment(
				relativeParentPath,
				child.name,
			);

			if (entries.length >= limit) {
				truncated = true;
				return false;
			}

			entries.push(formatWorkspaceKernelLsEntry(child, relativePath));

			if (recursive && !visit(child.id, relativePath)) {
				return false;
			}
		}

		return true;
	};

	visit(parentId, "");

	return {
		entries,
		truncated,
	};
}

function formatWorkspaceKernelLsEntry(
	item: WorkspaceItemSummary,
	displayPath: string,
) {
	if (item.type === "folder") {
		return `${displayPath}/`;
	}

	return `${displayPath} [${item.type}]`;
}

function clampWorkspaceListLimit(limit: number | undefined) {
	return Math.max(1, Math.min(limit ?? 100, 200));
}

function compareWorkspaceKernelItems(
	left: WorkspaceItemSummary,
	right: WorkspaceItemSummary,
) {
	return (
		left.sortOrder - right.sortOrder ||
		left.name.localeCompare(right.name) ||
		left.id.localeCompare(right.id)
	);
}

function joinWorkspacePathSegment(parentPath: string, name: string) {
	const segment = toWorkspacePathSegment(name);
	return parentPath ? `${parentPath}/${segment}` : segment;
}

function toWorkspacePathSegment(name: string) {
	return name.trim().replaceAll("/", "-") || "Untitled";
}

function normalizeWorkspacePath(path: string) {
	const trimmedPath = path.trim();

	if (!trimmedPath || trimmedPath === "/") {
		return "/";
	}

	if (!trimmedPath.startsWith("/")) {
		throw new Error("Workspace path must be absolute.");
	}

	const segments = trimmedPath
		.split("/")
		.filter(Boolean)
		.map((segment) => segment.trim())
		.filter(Boolean);

	return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function getWorkspaceItemByPath(
	path: string,
	tree: WorkspaceKernelTree,
): WorkspaceItemSummary | null {
	const segments = path.split("/").filter(Boolean);
	let parentId: string | null = null;
	let item: WorkspaceItemSummary | null = null;

	for (const segment of segments) {
		item =
			(tree.childrenByParentId.get(parentId) ?? []).find((child) => {
				return toWorkspacePathSegment(child.name) === segment;
			}) ?? null;

		if (!item) {
			return null;
		}

		parentId = item.id;
	}

	return item;
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
