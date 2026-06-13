import { useEffect } from "react";

import type { WorkspaceItem } from "#/features/workspaces/model/types";
import {
	selectWorkspaceSelectionItemIds,
	useWorkspaceSelectionStore,
} from "#/features/workspaces/state/workspace-selection-store";

interface UseWorkspaceSelectionInput {
	items: WorkspaceItem[];
	workspaceId: string;
}

interface UseWorkspaceSelectedItemsInput {
	itemsById: ReadonlyMap<string, WorkspaceItem>;
	workspaceId: string;
}

export function useWorkspaceSelection({
	items,
	workspaceId,
}: UseWorkspaceSelectionInput) {
	const storedSelectionItemIds = useWorkspaceSelectionStore(
		selectWorkspaceSelectionItemIds(workspaceId),
	);
	const clearStoredSelection = useWorkspaceSelectionStore(
		(state) => state.clearSelection,
	);
	const pruneStoredSelection = useWorkspaceSelectionStore(
		(state) => state.pruneSelection,
	);
	const setStoredItemSelected = useWorkspaceSelectionStore(
		(state) => state.setItemSelected,
	);
	const setStoredSelectedItemIds = useWorkspaceSelectionStore(
		(state) => state.setSelectedItemIds,
	);
	const selectedItemIds = new Set(storedSelectionItemIds);
	const selectedItems = items.filter((item) => selectedItemIds.has(item.id));
	const setSelectedItemIds = (itemIds: Iterable<string>) => {
		setStoredSelectedItemIds({
			workspaceId,
			itemIds,
			validItemIds: getWorkspaceSelectionValidItemIds(items),
		});
	};
	const setItemSelected = (item: WorkspaceItem, selected: boolean) => {
		setStoredItemSelected({
			workspaceId,
			itemId: item.id,
			selected,
		});
	};
	const clearSelection = () => {
		clearStoredSelection({ workspaceId });
	};

	useEffect(() => {
		pruneStoredSelection({
			workspaceId,
			validItemIds: getWorkspaceSelectionValidItemIds(items),
		});
	}, [items, pruneStoredSelection, workspaceId]);

	return {
		clearSelection,
		selectedItemIds,
		selectedItems,
		setSelectedItemIds,
		setItemSelected,
	};
}

export function useWorkspaceSelectedItems({
	itemsById,
	workspaceId,
}: UseWorkspaceSelectedItemsInput) {
	const selectedItemIds = useWorkspaceSelectionStore(
		selectWorkspaceSelectionItemIds(workspaceId),
	);
	const selectedItems: WorkspaceItem[] = [];

	for (const itemId of selectedItemIds) {
		const item = itemsById.get(itemId);

		if (item) {
			selectedItems.push(item);
		}
	}

	return selectedItems;
}

function getWorkspaceSelectionValidItemIds(items: readonly WorkspaceItem[]) {
	return new Set(items.map((item) => item.id));
}
