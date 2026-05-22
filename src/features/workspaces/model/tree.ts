import type { WorkspaceItem } from "#/features/workspaces/model/types";

export function getWorkspaceChildren(
	items: WorkspaceItem[],
	parentId: string | null,
) {
	return items
		.filter((item) => item.parentId === parentId)
		.slice()
		.sort(compareWorkspaceItems);
}

export function splitWorkspaceChildren(items: WorkspaceItem[]) {
	return {
		folders: items.filter((item) => item.type === "folder"),
		items: items.filter((item) => item.type !== "folder"),
	};
}

export function getWorkspaceBreadcrumbItems(
	item: WorkspaceItem | undefined,
	itemsById: Map<string, WorkspaceItem>,
) {
	if (!item) {
		return [];
	}

	const ancestors: WorkspaceItem[] = [];
	const seen = new Set<string>([item.id]);
	let parentId = item.parentId;

	while (parentId) {
		if (seen.has(parentId)) {
			break;
		}

		seen.add(parentId);
		const parent = itemsById.get(parentId);

		if (!parent) {
			break;
		}

		ancestors.unshift(parent);
		parentId = parent.parentId;
	}

	return [...ancestors, item];
}

export function getWorkspaceItemMeta(
	item: WorkspaceItem,
	allItems: WorkspaceItem[],
) {
	if (item.type !== "folder") {
		return item.meta;
	}

	const count = allItems.filter((child) => child.parentId === item.id).length;

	return `${count} ${count === 1 ? "item" : "items"}`;
}

function compareWorkspaceItems(a: WorkspaceItem, b: WorkspaceItem) {
	const orderDelta = a.sortOrder - b.sortOrder;

	if (orderDelta !== 0) {
		return orderDelta;
	}

	return a.name.localeCompare(b.name);
}
