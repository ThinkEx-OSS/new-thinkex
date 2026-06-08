import { useCallback, useEffect, useMemo } from "react";

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
	const validItemIds = useMemo(
		() => new Set(items.map((item) => item.id)),
		[items],
	);
	const selectedItemIds = useMemo(
		() => new Set(storedSelectionItemIds),
		[storedSelectionItemIds],
	);
	const selectedItems = useMemo(
		() => items.filter((item) => selectedItemIds.has(item.id)),
		[items, selectedItemIds],
	);
	const setSelectedItemIds = useCallback(
		(itemIds: Iterable<string>) => {
			setStoredSelectedItemIds({
				workspaceId,
				itemIds,
				validItemIds,
			});
		},
		[setStoredSelectedItemIds, validItemIds, workspaceId],
	);
	const setItemSelected = useCallback(
		(item: WorkspaceItem, selected: boolean) => {
			setStoredItemSelected({
				workspaceId,
				itemId: item.id,
				selected,
			});
		},
		[setStoredItemSelected, workspaceId],
	);
	const clearSelection = useCallback(() => {
		clearStoredSelection({ workspaceId });
	}, [clearStoredSelection, workspaceId]);

	useEffect(() => {
		pruneStoredSelection({
			workspaceId,
			validItemIds,
		});
	}, [pruneStoredSelection, validItemIds, workspaceId]);

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

	return useMemo(
		() =>
			selectedItemIds
				.map((itemId) => itemsById.get(itemId))
				.filter((item): item is WorkspaceItem => Boolean(item)),
		[itemsById, selectedItemIds],
	);
}
