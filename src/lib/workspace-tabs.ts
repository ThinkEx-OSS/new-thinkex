import type { WorkspaceItem } from "#/components/workspace/types";
import type { WorkspaceTab } from "#/stores/workspace-tabs";

export const WORKSPACE_ROOT_VIEW = "root";

export type WorkspaceTabSearch = {
	tab: string | undefined;
	view: string;
};

export function getTabViewKey(tab: WorkspaceTab) {
	return tab.viewItemId ?? WORKSPACE_ROOT_VIEW;
}

export function getWorkspaceTabSearch(tab: WorkspaceTab): WorkspaceTabSearch {
	return {
		tab: tab.id,
		view: getTabViewKey(tab),
	};
}

export function findItemForTab(
	tab: WorkspaceTab,
	itemsById: Map<string, WorkspaceItem>,
) {
	if (!tab.viewItemId) {
		return undefined;
	}

	return itemsById.get(tab.viewItemId);
}
