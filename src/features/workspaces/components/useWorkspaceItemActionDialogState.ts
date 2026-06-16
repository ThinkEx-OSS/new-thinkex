import { useState } from "react";

import type { WorkspaceItem } from "#/features/workspaces/model/types";

interface WorkspaceItemActionDialogState {
	renamingItem: WorkspaceItem | null;
	deletingItem: WorkspaceItem | null;
	deleteAlertOpen: boolean;
}

const initialWorkspaceItemActionDialogState: WorkspaceItemActionDialogState = {
	renamingItem: null,
	deletingItem: null,
	deleteAlertOpen: false,
};

export function useWorkspaceItemActionDialogState() {
	const [state, setState] = useState<WorkspaceItemActionDialogState>(
		initialWorkspaceItemActionDialogState,
	);
	const updateState = (patch: Partial<WorkspaceItemActionDialogState>) =>
		setState((current) => ({ ...current, ...patch }));

	return {
		deleteAlertOpen: state.deleteAlertOpen,
		deletingItem: state.deletingItem,
		renamingItem: state.renamingItem,
		clearDeletingItem: () =>
			updateState({ deletingItem: null, deleteAlertOpen: false }),
		openDeleteAlert: (deletingItem: WorkspaceItem) =>
			updateState({ deletingItem, deleteAlertOpen: true }),
		setDeleteAlertOpen: (deleteAlertOpen: boolean) =>
			updateState({ deleteAlertOpen }),
		setRenamingItem: (renamingItem: WorkspaceItem | null) =>
			updateState({ renamingItem }),
	};
}
