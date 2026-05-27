import {
	getWorkspaceDragData,
	getWorkspaceDropTargetData,
	getWorkspaceItemDragRow,
} from "./drag-data";
import { isWorkspaceSplitDropSide } from "./drag-guards";
import {
	WORKSPACE_TAB_DRAG_TYPE,
	type WorkspaceDragEntity,
	type WorkspaceDragSource,
	type WorkspaceDropTarget,
	type WorkspaceSplitDropSide,
} from "./drag-types";

const WORKSPACE_FOLDER_DROP_TARGET_ID_PREFIX = "workspace-folder-drop:";
const WORKSPACE_TAB_ITEM_INSERT_DROP_TARGET_ID_PREFIX =
	"workspace-tab-item-insert:";
const WORKSPACE_SPLIT_DROP_TARGET_ID_PREFIX = "workspace-split-drop:";
const WORKSPACE_AI_CONTEXT_DROP_TARGET_ID_PREFIX = "workspace-ai-context-drop:";

export function getWorkspaceDragSource(
	source: WorkspaceDragEntity | null | undefined,
): WorkspaceDragSource | undefined {
	if (!source || source.id == null) {
		return undefined;
	}

	const data = getWorkspaceDragData(source.data);

	if (data?.kind === "workspace-tab") {
		return {
			kind: "tab",
			tabId: data.tabId,
		};
	}

	if (data?.kind === "workspace-item") {
		return {
			kind: "workspace-item",
			itemId: data.itemId,
			parentId: data.parentId,
			row: data.row,
		};
	}

	if (source.type === WORKSPACE_TAB_DRAG_TYPE) {
		return {
			kind: "tab",
			tabId: String(source.id),
		};
	}

	const row = getWorkspaceItemDragRow(source.type);

	if (!row) {
		return undefined;
	}

	return {
		kind: "workspace-item",
		itemId: String(source.id),
		row,
	};
}

export function getWorkspaceDropTarget(
	target: WorkspaceDragEntity | null | undefined,
): WorkspaceDropTarget | undefined {
	if (!target || target.id == null) {
		return undefined;
	}

	const dragData = getWorkspaceDragData(target.data);

	if (dragData?.kind === "workspace-tab") {
		return {
			kind: "tab",
			tabId: dragData.tabId,
		};
	}

	if (dragData?.kind === "workspace-item") {
		return {
			kind: "workspace-item",
			itemId: dragData.itemId,
			parentId: dragData.parentId,
			row: dragData.row,
		};
	}

	const dropTargetData = getWorkspaceDropTargetData(target.data);

	if (dropTargetData?.kind === "workspace-tab-item-insert-drop-target") {
		return {
			kind: "tab-strip-insert",
			insertIndex: dropTargetData.index,
		};
	}

	if (dropTargetData?.kind === "workspace-folder-drop-target") {
		return {
			kind: "workspace-folder",
			folderId: dropTargetData.folderId,
			parentId: dropTargetData.parentId,
		};
	}

	if (dropTargetData?.kind === "workspace-pane-split-drop-target") {
		return {
			kind: "pane-split",
			paneId: dropTargetData.paneId,
			side: dropTargetData.side,
		};
	}

	if (dropTargetData?.kind === "workspace-ai-context-drop-target") {
		return {
			kind: "ai-context",
			workspaceId: dropTargetData.workspaceId,
		};
	}

	if (target.type === WORKSPACE_TAB_DRAG_TYPE) {
		return {
			kind: "tab",
			tabId: String(target.id),
		};
	}

	const insertIndex = getWorkspaceTabItemInsertDropTargetIndex(target.id);

	if (insertIndex != null) {
		return {
			kind: "tab-strip-insert",
			insertIndex,
		};
	}

	const folderId = getWorkspaceFolderDropTargetFolderId(target.id);

	if (folderId) {
		return {
			kind: "workspace-folder",
			folderId,
		};
	}

	const splitInput = getWorkspaceSplitDropTargetInput(target.id);

	if (splitInput) {
		return {
			kind: "pane-split",
			paneId: splitInput.paneId,
			side: splitInput.side,
		};
	}

	const aiContextWorkspaceId = getWorkspaceAiContextDropTargetWorkspaceId(
		target.id,
	);

	if (aiContextWorkspaceId) {
		return {
			kind: "ai-context",
			workspaceId: aiContextWorkspaceId,
		};
	}

	const row = getWorkspaceItemDragRow(target.type);

	if (!row) {
		return undefined;
	}

	return {
		kind: "workspace-item",
		itemId: String(target.id),
		row,
	};
}

export function getWorkspaceItemTabInsertMatch(input: {
	source: WorkspaceDragEntity | null | undefined;
	target: WorkspaceDragEntity | null | undefined;
}):
	| {
			source: Extract<WorkspaceDragSource, { kind: "workspace-item" }>;
			insertIndex: number;
	  }
	| undefined {
	const source = getWorkspaceDragSource(input.source);
	const target = getWorkspaceDropTarget(input.target);

	if (
		source?.kind !== "workspace-item" ||
		target?.kind !== "tab-strip-insert"
	) {
		return undefined;
	}

	return {
		source,
		insertIndex: target.insertIndex,
	};
}

export function getWorkspaceItemSortableGroup(input: {
	workspaceId: string;
	parentId: string | null;
	row: "folder" | "item";
}) {
	return [
		"workspace-items",
		input.workspaceId,
		input.parentId ?? "root",
		input.row,
	].join(":");
}

export function getWorkspaceFolderDropTargetId(folderId: string) {
	return `${WORKSPACE_FOLDER_DROP_TARGET_ID_PREFIX}${folderId}`;
}

function getWorkspaceFolderDropTargetFolderId(id: unknown) {
	if (typeof id !== "string") {
		return undefined;
	}

	if (!id.startsWith(WORKSPACE_FOLDER_DROP_TARGET_ID_PREFIX)) {
		return undefined;
	}

	const folderId = id.slice(WORKSPACE_FOLDER_DROP_TARGET_ID_PREFIX.length);

	return folderId || undefined;
}

export function getWorkspaceTabItemInsertDropTargetId(
	index: number,
	placement = "default",
) {
	return `${WORKSPACE_TAB_ITEM_INSERT_DROP_TARGET_ID_PREFIX}${index}:${placement}`;
}

function getWorkspaceTabItemInsertDropTargetIndex(id: unknown) {
	if (typeof id !== "string") {
		return undefined;
	}

	if (!id.startsWith(WORKSPACE_TAB_ITEM_INSERT_DROP_TARGET_ID_PREFIX)) {
		return undefined;
	}

	const [indexSegment] = id
		.slice(WORKSPACE_TAB_ITEM_INSERT_DROP_TARGET_ID_PREFIX.length)
		.split(":");
	const index = Number(indexSegment);

	return Number.isInteger(index) && index >= 0 ? index : undefined;
}

function getWorkspaceSplitDropTargetInput(id: unknown):
	| {
			paneId: string;
			side: WorkspaceSplitDropSide;
	  }
	| undefined {
	if (typeof id !== "string") {
		return undefined;
	}

	if (!id.startsWith(WORKSPACE_SPLIT_DROP_TARGET_ID_PREFIX)) {
		return undefined;
	}

	const value = id.slice(WORKSPACE_SPLIT_DROP_TARGET_ID_PREFIX.length);
	const sideSeparatorIndex = value.lastIndexOf(":");

	if (sideSeparatorIndex <= 0) {
		return undefined;
	}

	const paneId = decodeWorkspaceDropTargetSegment(
		value.slice(0, sideSeparatorIndex),
	);
	const side = value.slice(sideSeparatorIndex + 1);

	if (!paneId || !isWorkspaceSplitDropSide(side)) {
		return undefined;
	}

	return {
		paneId,
		side,
	};
}

function getWorkspaceAiContextDropTargetWorkspaceId(id: unknown) {
	if (typeof id !== "string") {
		return undefined;
	}

	if (!id.startsWith(WORKSPACE_AI_CONTEXT_DROP_TARGET_ID_PREFIX)) {
		return undefined;
	}

	const workspaceId = decodeWorkspaceDropTargetSegment(
		id.slice(WORKSPACE_AI_CONTEXT_DROP_TARGET_ID_PREFIX.length),
	);

	return workspaceId || undefined;
}

function decodeWorkspaceDropTargetSegment(value: string) {
	try {
		return decodeURIComponent(value);
	} catch {
		return undefined;
	}
}
