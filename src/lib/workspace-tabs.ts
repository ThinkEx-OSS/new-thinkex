import type { WorkspaceItem } from "#/components/workspace/types";
import type { WorkspaceTab } from "#/stores/workspace-tabs";

export type WorkspaceTabSearch = {
	tab: string | undefined;
	view: string | undefined;
};

export function getTabViewKey(tab: WorkspaceTab) {
	return tab.kind === "item" && tab.itemId ? tab.itemId : "root";
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
	if (!tab.itemId) {
		return undefined;
	}

	return itemsById.get(tab.itemId);
}
