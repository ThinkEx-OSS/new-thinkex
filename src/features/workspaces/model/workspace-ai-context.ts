import type { WorkspaceTab } from "#/features/workspaces/model/tab-types";
import type { WorkspaceItem } from "#/features/workspaces/model/types";

export type WorkspaceAiContextChip =
	| WorkspaceAiContextSingleChip
	| WorkspaceAiContextListChip;

export type WorkspaceAiContextSingleChip = {
	type: "single";
	id: string;
	icon: WorkspaceAiContextSingleIcon;
	item: WorkspaceItem;
	label: string;
};

export type WorkspaceAiContextListChip = {
	type: "list";
	id: string;
	ariaLabel: string;
	icon: "selected-items";
	label: string;
	items: WorkspaceAiContextListItem[];
};

export type WorkspaceAiContextListItem = {
	id: string;
	item: WorkspaceItem;
	label: string;
};

export type WorkspaceAiContextSingleIcon = "current-item" | "workspace-item";

export type WorkspaceAiContextScope = {
	activeItem?: WorkspaceItem;
	itemsById: ReadonlyMap<string, WorkspaceItem>;
	// Kept for the future prompt-context payload, but not rendered as chips yet.
	tabs: WorkspaceTab[];
	workspaceId: string;
};

export type WorkspaceAiContextModelInput = {
	activeItem?: WorkspaceItem;
	selectedItems: WorkspaceItem[];
};

const SELECTED_ITEM_INLINE_LIMIT = 2;

export function getWorkspaceAiContextChips({
	activeItem,
	selectedItems,
}: WorkspaceAiContextModelInput): WorkspaceAiContextChip[] {
	return [
		...(activeItem ? [getActiveItemContextChip(activeItem)] : []),
		...getSelectedItemContextChips(selectedItems),
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

function getWorkspaceItemListContextItem(
	item: WorkspaceItem,
): WorkspaceAiContextListItem {
	return {
		id: item.id,
		label: item.name,
		item,
	};
}
