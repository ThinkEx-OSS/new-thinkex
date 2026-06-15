import { getWorkspaceItemTypeMeta } from "#/features/workspaces/defaults";
import { joinWorkspacePathSegment } from "#/features/workspaces/kernel/workspace-kernel-paths";
import type { WorkspaceTab } from "#/features/workspaces/model/tab-types";
import { getWorkspaceBreadcrumbItems } from "#/features/workspaces/model/tree";
import type { WorkspaceItem } from "#/features/workspaces/model/types";

import type {
	WorkspaceAiContextItemReference,
	WorkspaceAiContextScope,
} from "./workspace-ai-context-types";

export function getWorkspaceAiContextItemReference(input: {
	context: WorkspaceAiContextScope;
	item: WorkspaceItem;
	openTabItemIds: ReadonlyMap<string, string[]>;
}): WorkspaceAiContextItemReference {
	const { context, item, openTabItemIds } = input;

	return {
		name: item.name,
		path: getWorkspaceAiContextItemPath(item, context.itemsById),
		type: getWorkspaceItemTypeMeta(item.type),
		state: {
			activeVisible: context.activeItem?.id === item.id,
			openInTabs: openTabItemIds.get(item.id) ?? [],
		},
	};
}

export function getOpenTabItemIds(tabs: WorkspaceTab[]) {
	const itemTabTitles = new Map<string, string[]>();

	for (const tab of tabs) {
		if (!tab.viewItemId) {
			continue;
		}

		const titles = itemTabTitles.get(tab.viewItemId) ?? [];
		titles.push(tab.title);
		itemTabTitles.set(tab.viewItemId, titles);
	}

	return itemTabTitles;
}

function getWorkspaceAiContextItemPath(
	item: WorkspaceItem,
	itemsById: ReadonlyMap<string, WorkspaceItem>,
) {
	const breadcrumbItems = getWorkspaceBreadcrumbItems(
		item,
		itemsById instanceof Map ? itemsById : new Map(itemsById),
	);
	const relativePath = breadcrumbItems.reduce(
		(path, entry) => joinWorkspacePathSegment(path, entry.name),
		"",
	);

	return `/${relativePath}`;
}
