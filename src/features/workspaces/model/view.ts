import type { WorkspaceItem } from "#/features/workspaces/model/types";

export type WorkspaceViewMode = "root" | "folder" | "item";

export function getWorkspaceViewMode(
	activeItem?: WorkspaceItem,
): WorkspaceViewMode {
	if (!activeItem) {
		return "root";
	}

	if (activeItem.type === "folder") {
		return "folder";
	}

	return "item";
}

export function isWorkspaceItemView(
	activeItem?: WorkspaceItem,
): activeItem is WorkspaceItem {
	return getWorkspaceViewMode(activeItem) === "item";
}

export function getWorkspaceBrowseParentId(activeItem?: WorkspaceItem) {
	return activeItem?.type === "folder" ? activeItem.id : null;
}
