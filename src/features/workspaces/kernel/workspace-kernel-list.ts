import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
import { normalizeWorkspaceItemName } from "#/features/workspaces/defaults";

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

export function listWorkspaceKernelPageItems(input: {
	items: WorkspaceItemSummary[];
	path?: string;
	recursive?: boolean;
	limit?: number;
}): ListWorkspaceKernelItemsResult {
	const tree = buildWorkspaceKernelTree(input.items);
	const cwd = resolveWorkspaceKernelCwd(input.path ?? "/", tree);
	const boundedLimit = clampWorkspaceListLimit(input.limit);
	const listing = collectWorkspaceKernelListEntries({
		parentId: cwd.parentId,
		recursive: input.recursive ?? false,
		limit: boundedLimit,
		childrenByParentId: tree.childrenByParentId,
	});

	return {
		path: cwd.path,
		count: listing.entries.length,
		more: listing.truncated,
		entries: listing.entries,
	};
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
	return normalizeWorkspaceItemName(name);
}

function normalizeWorkspacePath(path: string) {
	const trimmedPath = path.trim();

	if (!trimmedPath || trimmedPath === "/") {
		return "/";
	}

	if (!trimmedPath.startsWith("/")) {
		throw new Error("Workspace path must be absolute.");
	}

	const segments = trimmedPath.split("/").flatMap((segment) => {
		const normalizedSegment = segment.trim();
		return normalizedSegment ? [normalizedSegment] : [];
	});

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
