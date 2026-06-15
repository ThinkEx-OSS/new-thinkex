import {
	getOpenTabItemIds,
	getWorkspaceAiContextItemReference,
} from "./workspace-ai-context-reference";
import type {
	WorkspaceAiContextChip,
	WorkspaceAiContextScope,
} from "./workspace-ai-context-types";

export function getWorkspaceAiContextChips(
	context: WorkspaceAiContextScope,
): WorkspaceAiContextChip[] {
	const openTabItemIds = getOpenTabItemIds(context.tabs);

	return context.aiContextItemIds.flatMap((itemId) => {
		const item = context.itemsById.get(itemId);

		if (!item) {
			return [];
		}

		const reference = getWorkspaceAiContextItemReference({
			item,
			context,
			openTabItemIds,
		});

		return [
			{
				id: item.id,
				item,
				isActiveVisible: reference.state.activeVisible,
				label: reference.name,
				path: reference.path,
			},
		];
	});
}
