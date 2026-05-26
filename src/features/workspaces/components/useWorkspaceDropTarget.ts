import { type UseDroppableInput, useDroppable } from "@dnd-kit/react";

import {
	createWorkspaceAiContextDropTargetData,
	createWorkspaceFolderDropTargetData,
	createWorkspaceSplitDropTargetData,
	createWorkspaceTabItemInsertDropTargetData,
	getWorkspaceAiContextDropTargetId,
	getWorkspaceFolderDropTargetId,
	getWorkspaceSplitDropTargetId,
	getWorkspaceTabItemInsertDropTargetId,
	WORKSPACE_AI_CONTEXT_DROP_TYPE,
	WORKSPACE_FOLDER_DRAG_TYPE,
	WORKSPACE_ITEM_DRAG_TYPES,
	WORKSPACE_OPENABLE_DRAG_TYPES,
	WORKSPACE_SPLIT_DROP_TYPE,
	WORKSPACE_TAB_ITEM_INSERT_DROP_TYPE,
	type WorkspaceDropTargetData,
	type WorkspaceSplitDropSide,
} from "#/features/workspaces/model/drag";

type WorkspaceDropTargetBehavior = Pick<
	UseDroppableInput<WorkspaceDropTargetData>,
	"collisionDetector" | "collisionPriority" | "disabled" | "element"
>;

export function useWorkspaceDropTarget(
	input: Omit<UseDroppableInput<WorkspaceDropTargetData>, "data"> & {
		data: WorkspaceDropTargetData;
	},
) {
	return useDroppable<WorkspaceDropTargetData>(input);
}

export function useWorkspaceFolderDropTarget(
	input: WorkspaceDropTargetBehavior & {
		folderId: string;
		parentId: string | null;
	},
) {
	return useWorkspaceDropTarget({
		id: getWorkspaceFolderDropTargetId(input.folderId),
		type: WORKSPACE_FOLDER_DRAG_TYPE,
		accept: WORKSPACE_ITEM_DRAG_TYPES,
		collisionDetector: input.collisionDetector,
		collisionPriority: input.collisionPriority,
		disabled: input.disabled,
		element: input.element,
		data: createWorkspaceFolderDropTargetData({
			folderId: input.folderId,
			parentId: input.parentId,
		}),
	});
}

export function useWorkspaceTabItemInsertDropTarget(
	input: WorkspaceDropTargetBehavior & {
		index: number;
		placement?: string;
	},
) {
	return useWorkspaceDropTarget({
		id: getWorkspaceTabItemInsertDropTargetId(input.index, input.placement),
		type: WORKSPACE_TAB_ITEM_INSERT_DROP_TYPE,
		accept: WORKSPACE_ITEM_DRAG_TYPES,
		collisionDetector: input.collisionDetector,
		collisionPriority: input.collisionPriority,
		disabled: input.disabled,
		element: input.element,
		data: createWorkspaceTabItemInsertDropTargetData(input.index),
	});
}

export function useWorkspaceSplitDropTarget(
	input: WorkspaceDropTargetBehavior & {
		paneId: string;
		side: WorkspaceSplitDropSide;
	},
) {
	return useWorkspaceDropTarget({
		id: getWorkspaceSplitDropTargetId({
			paneId: input.paneId,
			side: input.side,
		}),
		type: WORKSPACE_SPLIT_DROP_TYPE,
		accept: WORKSPACE_OPENABLE_DRAG_TYPES,
		collisionDetector: input.collisionDetector,
		collisionPriority: input.collisionPriority,
		disabled: input.disabled,
		element: input.element,
		data: createWorkspaceSplitDropTargetData({
			paneId: input.paneId,
			side: input.side,
		}),
	});
}

export function useWorkspaceAiContextDropTarget(
	input: WorkspaceDropTargetBehavior & {
		workspaceId: string;
	},
) {
	return useWorkspaceDropTarget({
		id: getWorkspaceAiContextDropTargetId(input.workspaceId),
		type: WORKSPACE_AI_CONTEXT_DROP_TYPE,
		accept: WORKSPACE_ITEM_DRAG_TYPES,
		collisionDetector: input.collisionDetector,
		collisionPriority: input.collisionPriority,
		disabled: input.disabled,
		element: input.element,
		data: createWorkspaceAiContextDropTargetData({
			workspaceId: input.workspaceId,
		}),
	});
}
