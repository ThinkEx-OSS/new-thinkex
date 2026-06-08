import type { WorkspaceTab } from "#/features/workspaces/model/tab-types";
import type { WorkspaceItem } from "#/features/workspaces/model/types";

export type WorkspaceAiContextChip =
	| WorkspaceAiContextSingleChip
	| WorkspaceAiContextListChip;

export type WorkspaceAiContextSingleChip = {
	type: "single";
	id: string;
	icon: WorkspaceAiContextIcon;
	item?: WorkspaceItem;
	label: string;
};

export type WorkspaceAiContextListChip = {
	type: "list";
	id: string;
	ariaLabel: string;
	icon: WorkspaceAiContextIcon;
	label: string;
	items: WorkspaceAiContextListItem[];
};

export type WorkspaceAiContextListItem = {
	id: string;
	item?: WorkspaceItem;
	label: string;
};

export type WorkspaceAiContextIcon =
	| "current-item"
	| "open-tabs"
	| "selected-items"
	| "workspace-item";

export type WorkspaceAiContextScope = {
	activeItem?: WorkspaceItem;
	itemsById: ReadonlyMap<string, WorkspaceItem>;
	tabs: WorkspaceTab[];
	workspaceId: string;
};

export type WorkspaceAiContextModelInput = {
	activeItem?: WorkspaceItem;
	itemsById: ReadonlyMap<string, WorkspaceItem>;
	selectedItems: WorkspaceItem[];
	tabs: WorkspaceTab[];
};

const SELECTED_ITEM_INLINE_LIMIT = 2;

export function getWorkspaceAiContextChips({
	activeItem,
	itemsById,
	selectedItems,
	tabs,
}: WorkspaceAiContextModelInput): WorkspaceAiContextChip[] {
	return [
		...(activeItem ? [getActiveItemContextChip(activeItem)] : []),
		...getSelectedItemContextChips(selectedItems),
		...getOpenTabContextChips({ itemsById, tabs }),
	];
}

function getActiveItemContextChip(
	item: WorkspaceItem,
): WorkspaceAiContextSingleChip {
	return {
		type: "single",
		id: `active-item:${item.id}`,
		icon: "current-item",
		item,
		label: item.name,
	};
}

function getSelectedItemContextChips(
	selectedItems: WorkspaceItem[],
): WorkspaceAiContextChip[] {
	if (selectedItems.length === 0) {
		return [];
	}

	if (selectedItems.length > SELECTED_ITEM_INLINE_LIMIT) {
		return [
			{
				type: "list",
				id: "selected-items",
				icon: "selected-items",
				label: `${selectedItems.length} items`,
				ariaLabel: `${selectedItems.length} selected items`,
				items: selectedItems.map(getWorkspaceItemListContextItem),
			},
		];
	}

	return selectedItems.map((item) => ({
		type: "single",
		id: `selected-item:${item.id}`,
		icon: "workspace-item",
		item,
		label: item.name,
	}));
}

function getOpenTabContextChips({
	itemsById,
	tabs,
}: {
	itemsById: ReadonlyMap<string, WorkspaceItem>;
	tabs: WorkspaceTab[];
}): WorkspaceAiContextChip[] {
	if (tabs.length <= 1) {
		return [];
	}

	const items = tabs.map((tab) => {
		const item = tab.viewItemId ? itemsById.get(tab.viewItemId) : undefined;

		return {
			id: tab.id,
			label: item?.name ?? tab.title,
			item,
		};
	});

	return [
		{
			type: "list",
			id: "open-tabs",
			icon: "open-tabs",
			label: `${tabs.length} tabs`,
			ariaLabel: `${tabs.length} open workspace tabs`,
			items,
		},
	];
}

function getWorkspaceItemListContextItem(
	item: WorkspaceItem,
): WorkspaceAiContextListItem {
	return {
		id: item.id,
		label: item.name,
		item,
	};
}
