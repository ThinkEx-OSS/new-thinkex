import type { SortableDisabled } from "@dnd-kit/dom/sortable";

import type { WorkspaceMembershipRole } from "#/features/workspaces/contracts";

const readOnlyItemSortableDisabled: SortableDisabled = { droppable: true };

export interface WorkspaceMemberCapabilities {
	role: WorkspaceMembershipRole;
	canMutateContent: boolean;
	canDeleteWorkspace: boolean;
	itemSortableDisabled: boolean | SortableDisabled;
}

export function getWorkspaceMemberCapabilities(
	role: WorkspaceMembershipRole,
): WorkspaceMemberCapabilities {
	const canMutateContent = role !== "viewer";

	return {
		role,
		canMutateContent,
		canDeleteWorkspace: role === "owner",
		itemSortableDisabled: canMutateContent
			? false
			: readOnlyItemSortableDisabled,
	};
}
