import { getWorkspaceSubtreeItemIds } from "#/features/workspaces/model/tree";
import type { WorkspaceItem } from "#/features/workspaces/model/types";

const workspaceRootPickerNodeId = "workspace-root";

export interface WorkspaceItemTreePickerNode {
	id: string;
	value: string | null;
	label: string;
	path: string;
	depth: number;
	item?: WorkspaceItem;
	children: WorkspaceItemTreePickerNode[];
}

function getWorkspacePickerNodeId(value: string | null) {
	return value ?? workspaceRootPickerNodeId;
}

export function createWorkspaceFolderTreePickerNodes(input: {
	items: readonly WorkspaceItem[];
	excludedFolderIds?: ReadonlySet<string>;
	rootLabel?: string;
}) {
	const excludedFolderIds = input.excludedFolderIds ?? new Set<string>();
	const folderItems = input.items.filter(
		(item) => item.type === "folder" && !excludedFolderIds.has(item.id),
	);

	return [
		createWorkspaceTreePickerNode({
			childrenByParentId: groupWorkspaceFoldersByParentId(folderItems),
			depth: 0,
			item: undefined,
			label: input.rootLabel ?? "Workspace root",
			path: "/",
			value: null,
		}),
	];
}

export function filterWorkspaceItemTreePickerNodes(
	nodes: readonly WorkspaceItemTreePickerNode[],
	query: string,
) {
	const normalizedQuery = normalizeWorkspaceItemTreePickerSearch(query);

	if (!normalizedQuery) {
		return [...nodes];
	}

	return nodes
		.map((node) => filterWorkspaceItemTreePickerNode(node, normalizedQuery))
		.filter((node): node is WorkspaceItemTreePickerNode => Boolean(node));
}

export function getWorkspaceMoveTargetExcludedFolderIds(input: {
	items: readonly WorkspaceItem[];
	itemIds: readonly string[];
}) {
	return getWorkspaceSubtreeItemIds(input.items, input.itemIds);
}

export function getCommonWorkspaceItemParentId(
	items: readonly WorkspaceItem[],
) {
	if (items.length === 0) {
		return undefined;
	}

	const parentId = items[0].parentId;

	return items.every((item) => item.parentId === parentId)
		? parentId
		: undefined;
}

function createWorkspaceTreePickerNode(input: {
	childrenByParentId: ReadonlyMap<string | null, WorkspaceItem[]>;
	depth: number;
	item: WorkspaceItem | undefined;
	label: string;
	path: string;
	value: string | null;
}): WorkspaceItemTreePickerNode {
	const childItems = input.childrenByParentId.get(input.value) ?? [];

	return {
		id: getWorkspacePickerNodeId(input.value),
		value: input.value,
		label: input.label,
		path: input.path,
		depth: input.depth,
		item: input.item,
		children: childItems.map((item) =>
			createWorkspaceTreePickerNode({
				childrenByParentId: input.childrenByParentId,
				depth: input.depth + 1,
				item,
				label: item.name,
				path: getWorkspaceItemPickerPath(input.path, item.name),
				value: item.id,
			}),
		),
	};
}

function groupWorkspaceFoldersByParentId(items: readonly WorkspaceItem[]) {
	const childrenByParentId = new Map<string | null, WorkspaceItem[]>();

	for (const item of [...items].sort(compareWorkspaceTreePickerItems)) {
		const siblings = childrenByParentId.get(item.parentId) ?? [];
		siblings.push(item);
		childrenByParentId.set(item.parentId, siblings);
	}

	return childrenByParentId;
}

function filterWorkspaceItemTreePickerNode(
	node: WorkspaceItemTreePickerNode,
	normalizedQuery: string,
): WorkspaceItemTreePickerNode | null {
	const children = node.children
		.map((child) => filterWorkspaceItemTreePickerNode(child, normalizedQuery))
		.filter((child): child is WorkspaceItemTreePickerNode => Boolean(child));
	const selfMatches =
		normalizeWorkspaceItemTreePickerSearch(node.label).includes(
			normalizedQuery,
		) ||
		normalizeWorkspaceItemTreePickerSearch(node.path).includes(normalizedQuery);

	if (!selfMatches && children.length === 0) {
		return null;
	}

	return { ...node, children };
}

function getWorkspaceItemPickerPath(parentPath: string, itemName: string) {
	return parentPath === "/" ? `/${itemName}` : `${parentPath}/${itemName}`;
}

function compareWorkspaceTreePickerItems(
	first: WorkspaceItem,
	second: WorkspaceItem,
) {
	const orderDelta = first.sortOrder - second.sortOrder;

	if (orderDelta !== 0) {
		return orderDelta;
	}

	return first.name.localeCompare(second.name);
}

function normalizeWorkspaceItemTreePickerSearch(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}
