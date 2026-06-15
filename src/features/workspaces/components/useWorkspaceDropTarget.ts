import { type UseDroppableInput, useDroppable } from "@dnd-kit/react";

import {
	createWorkspaceAiContextDropTargetData,
	createWorkspaceFolderDropTargetData,
	createWorkspaceTabItemInsertDropTargetData,
	getWorkspaceAiContextDropTargetId,
	getWorkspaceFolderDropTargetId,
	getWorkspaceTabItemInsertDropTargetId,
	WORKSPACE_FOLDER_DRAG_TYPE,
	WORKSPACE_ITEM_DRAG_TYPES,
	WORKSPACE_TAB_ITEM_INSERT_DROP_TYPE,
	type WorkspaceDropTargetData,
} from "#/features/workspaces/model/drag";

type WorkspaceDropTargetBehavior = Pick<
	UseDroppableInput<WorkspaceDropTargetData>,
	"collisionDetector" | "collisionPriority" | "disabled" | "element"
>;

function useWorkspaceDropTarget(
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

export function useWorkspaceAiContextDropTarget(
	input: WorkspaceDropTargetBehavior & {
		workspaceId: string;
	},
) {
	return useWorkspaceDropTarget({
		id: getWorkspaceAiContextDropTargetId(input.workspaceId),
		type: "workspace-ai-context-drop-target",
		accept: WORKSPACE_ITEM_DRAG_TYPES,
		collisionDetector: input.collisionDetector,
		collisionPriority: input.collisionPriority,
		disabled: input.disabled,
		element: input.element,
		data: createWorkspaceAiContextDropTargetData(input.workspaceId),
	});
}
