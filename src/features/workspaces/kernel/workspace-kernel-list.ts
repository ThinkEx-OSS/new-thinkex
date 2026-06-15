import type {
	WorkspaceItemSummary,
	WorkspaceItemType,
} from "#/features/workspaces/contracts";
import {
	buildWorkspaceKernelTree,
	joinWorkspacePathSegment,
	resolveWorkspaceKernelCwd,
} from "#/features/workspaces/kernel/workspace-kernel-paths";

export interface ListWorkspaceKernelItemsResult {
	path: string;
	count: number;
	more: boolean;
	entries: WorkspaceKernelListEntry[];
}

export interface WorkspaceKernelListEntry {
	path: string;
	title: string;
	type: WorkspaceItemType;
}

interface WorkspaceKernelListEntries {
	entries: WorkspaceKernelListEntry[];
	truncated: boolean;
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
		basePath: cwd.path,
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

function collectWorkspaceKernelListEntries({
	parentId,
	basePath,
	recursive,
	limit,
	childrenByParentId,
}: {
	parentId: string | null;
	basePath: string;
	recursive: boolean;
	limit: number;
	childrenByParentId: Map<string | null, WorkspaceItemSummary[]>;
}): WorkspaceKernelListEntries {
	const entries: WorkspaceKernelListEntry[] = [];
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

			entries.push(
				formatWorkspaceKernelListEntry({
					item: child,
					path: toAbsoluteWorkspaceListPath(basePath, relativePath),
				}),
			);

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

function formatWorkspaceKernelListEntry(input: {
	item: WorkspaceItemSummary;
	path: string;
}): WorkspaceKernelListEntry {
	return {
		path: input.path,
		title: input.item.name,
		type: input.item.type,
	};
}

function toAbsoluteWorkspaceListPath(basePath: string, relativePath: string) {
	if (basePath === "/") {
		return `/${relativePath}`;
	}

	return `${basePath}/${relativePath}`;
}

function clampWorkspaceListLimit(limit: number | undefined) {
	return Math.max(1, Math.min(limit ?? 100, 200));
}
