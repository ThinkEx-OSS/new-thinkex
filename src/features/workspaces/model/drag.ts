import { move } from "@dnd-kit/helpers";
import type { DragDropEventHandlers } from "@dnd-kit/react";

import type {
	MoveWorkspaceItemInput,
	ReorderWorkspaceItemsInput,
} from "#/features/workspaces/contracts";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import {
	arraysEqual,
	getWorkspaceItemOrderScopeKey,
	haveSameIds,
} from "#/features/workspaces/workspace-item-ordering";

export const WORKSPACE_TAB_DRAG_TYPE = "workspace-tab";
export const WORKSPACE_FOLDER_DRAG_TYPE = "workspace-folder";
export const WORKSPACE_ITEM_DRAG_TYPE = "workspace-item";
const WORKSPACE_FOLDER_DROP_TARGET_ID_PREFIX = "workspace-folder-drop:";

export type WorkspaceDragCommand =
	| {
			type: "reorder-tabs-over-tab";
			activeTabId: string;
			overTabId: string;
	  }
	| {
			type: "move-tab-in-strip";
			tabId: string;
			toIndex: number;
	  }
	| {
			type: "split-tab";
			tabId: string;
			targetPaneId: string;
			side: "left" | "right" | "top" | "bottom";
	  }
	| {
			type: "move-tab-to-pane";
			tabId: string;
			targetPaneId: string;
	  };

export type WorkspaceDragEndEvent = {
	operation: {
		canceled?: boolean;
		source?: {
			id: unknown;
			type?: unknown;
			index?: unknown;
			initialIndex?: unknown;
			group?: unknown;
			initialGroup?: unknown;
		} | null;
		target?: { id: unknown; type?: unknown; group?: unknown } | null;
	};
	canceled?: boolean;
	preventDefault?: () => void;
};

type DndDragEndEvent = Parameters<
	NonNullable<DragDropEventHandlers["onDragEnd"]>
>[0];

export function getWorkspaceDragCommand(
	event: WorkspaceDragEndEvent,
): WorkspaceDragCommand | undefined {
	const { source, target } = event.operation;
	const canceled = event.canceled ?? event.operation.canceled;

	if (canceled || !source) {
		return undefined;
	}

	if (source.type !== WORKSPACE_TAB_DRAG_TYPE) {
		return undefined;
	}

	if (
		typeof source.index === "number" &&
		typeof source.initialIndex === "number" &&
		source.index !== source.initialIndex
	) {
		return {
			type: "move-tab-in-strip",
			tabId: String(source.id),
			toIndex: source.index,
		};
	}

	if (target?.type === WORKSPACE_TAB_DRAG_TYPE) {
		return {
			type: "reorder-tabs-over-tab",
			activeTabId: String(source.id),
			overTabId: String(target.id),
		};
	}

	return undefined;
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

export function getWorkspaceFolderDropTargetFolderId(id: unknown) {
	if (typeof id !== "string") {
		return undefined;
	}

	if (!id.startsWith(WORKSPACE_FOLDER_DROP_TARGET_ID_PREFIX)) {
		return undefined;
	}

	const folderId = id.slice(WORKSPACE_FOLDER_DROP_TARGET_ID_PREFIX.length);

	return folderId || undefined;
}

export function getWorkspaceItemDragRow(type: unknown) {
	if (type === WORKSPACE_FOLDER_DRAG_TYPE) {
		return "folder" as const;
	}

	if (type === WORKSPACE_ITEM_DRAG_TYPE) {
		return "item" as const;
	}

	return undefined;
}

export function shouldPreventWorkspaceItemOptimisticSorting(
	event: WorkspaceDragEndEvent,
) {
	const { source, target } = event.operation;
	const sourceRow = getWorkspaceItemDragRow(source?.type);
	const targetRow = getWorkspaceItemDragRow(target?.type);

	if (!sourceRow || !targetRow) {
		return false;
	}

	return sourceRow !== targetRow;
}

export function shouldPreventWorkspacePointerActivation(
	event: PointerEvent,
	source: { element?: Element; handle?: Element },
) {
	const { target } = event;

	if (!(target instanceof Element)) {
		return false;
	}

	if (target.closest("[data-workspace-drag-open]")) {
		return false;
	}

	if (target === source.element || target === source.handle) {
		return false;
	}

	if (source.handle?.contains(target)) {
		return false;
	}

	const interactiveElement = target.closest(
		[
			"input:not([disabled])",
			"select:not([disabled])",
			"textarea:not([disabled])",
			"button:not([disabled])",
			"a[href]",
			'[contenteditable]:not([contenteditable="false"])',
		].join(","),
	);

	if (interactiveElement === source.element) {
		return false;
	}

	return Boolean(interactiveElement);
}

export function getSortableDebugFields(
	operation: DndDragEndEvent["operation"],
) {
	const source = operation.source as
		| {
				index?: unknown;
				initialIndex?: unknown;
				group?: unknown;
				initialGroup?: unknown;
		  }
		| null
		| undefined;
	const target = operation.target as
		| {
				group?: unknown;
		  }
		| null
		| undefined;

	return {
		sourceIndex: source?.index,
		sourceInitialIndex: source?.initialIndex,
		sourceGroup: source?.group,
		sourceInitialGroup: source?.initialGroup,
		targetGroup: target?.group,
	};
}

export type WorkspaceItemMoveResolution =
	| {
			kind: "move";
			sourceOrderScopeKey: string;
			mutationInput: MoveWorkspaceItemInput;
	  }
	| {
			kind: "blocked";
			reason:
				| "canceled"
				| "missing-source"
				| "missing-target-folder"
				| "self"
				| "same-parent"
				| "descendant";
			sourceId?: unknown;
			targetFolderId?: string;
	  };

export function getWorkspaceItemMoveResolution(input: {
	event: DndDragEndEvent;
	items: WorkspaceItem[];
	workspaceId: string;
}): WorkspaceItemMoveResolution | undefined {
	const { event, items, workspaceId } = input;
	const { source } = event.operation;
	const canceled = event.canceled ?? event.operation.canceled;
	const targetFolderId = getWorkspaceFolderDropTargetFolderId(
		event.operation.target?.id,
	);

	if (!targetFolderId) {
		return undefined;
	}

	if (canceled) {
		return {
			kind: "blocked",
			reason: "canceled",
			sourceId: source?.id,
			targetFolderId,
		};
	}

	if (!source) {
		return {
			kind: "blocked",
			reason: "missing-source",
			targetFolderId,
		};
	}

	const sourceRow = getWorkspaceItemDragRow(source.type);
	const sourceItem = items.find((item) => item.id === String(source.id));
	const targetFolder = items.find((item) => item.id === targetFolderId);

	if (!sourceRow || !sourceItem) {
		return {
			kind: "blocked",
			reason: "missing-source",
			sourceId: source.id,
			targetFolderId,
		};
	}

	if (!targetFolder || targetFolder.type !== "folder") {
		return {
			kind: "blocked",
			reason: "missing-target-folder",
			sourceId: source.id,
			targetFolderId,
		};
	}

	if (sourceItem.id === targetFolderId) {
		return {
			kind: "blocked",
			reason: "self",
			sourceId: source.id,
			targetFolderId,
		};
	}

	if (sourceItem.parentId === targetFolderId) {
		return {
			kind: "blocked",
			reason: "same-parent",
			sourceId: source.id,
			targetFolderId,
		};
	}

	if (
		sourceItem.type === "folder" &&
		isWorkspaceItemDescendantOf(items, {
			ancestorId: sourceItem.id,
			itemId: targetFolderId,
		})
	) {
		return {
			kind: "blocked",
			reason: "descendant",
			sourceId: source.id,
			targetFolderId,
		};
	}

	return {
		kind: "move",
		sourceOrderScopeKey: getWorkspaceItemOrderScopeKey({
			workspaceId,
			parentId: sourceItem.parentId,
			row: sourceRow,
		}),
		mutationInput: {
			workspaceId,
			itemId: sourceItem.id,
			targetParentId: targetFolderId,
		},
	};
}

export function getWorkspaceItemReorderInput(input: {
	event: DndDragEndEvent;
	items: WorkspaceItem[];
	orderRef: Map<string, string[]>;
	workspaceId: string;
}):
	| { orderScopeKey: string; mutationInput: ReorderWorkspaceItemsInput }
	| undefined {
	const { event, items, orderRef, workspaceId } = input;
	const { source, target } = event.operation;
	const canceled = event.canceled ?? event.operation.canceled;
	const sourceRow = getWorkspaceItemDragRow(source?.type);
	const targetRow = getWorkspaceItemDragRow(target?.type);

	if (canceled || !source || !target || !sourceRow || sourceRow !== targetRow) {
		return undefined;
	}

	const movedItemId = String(source.id);
	const movedItem = items.find((item) => item.id === movedItemId);

	if (!movedItem) {
		return undefined;
	}

	const siblings = items.filter(
		(item) =>
			item.parentId === movedItem.parentId &&
			(sourceRow === "folder"
				? item.type === "folder"
				: item.type !== "folder"),
	);
	const siblingItemIds = siblings.map((item) => item.id);
	const orderScopeKey = getWorkspaceItemOrderScopeKey({
		workspaceId,
		parentId: movedItem.parentId,
		row: sourceRow,
	});
	const refItemIds = orderRef.get(orderScopeKey);
	const rowItemIds =
		refItemIds && haveSameIds(refItemIds, siblingItemIds)
			? refItemIds
			: siblingItemIds;
	const orderedItemIds = move(rowItemIds, event);

	if (arraysEqual(rowItemIds, orderedItemIds)) {
		return undefined;
	}

	return {
		orderScopeKey,
		mutationInput: {
			workspaceId,
			parentId: movedItem.parentId,
			row: sourceRow,
			movedItemId,
			orderedItemIds,
		},
	};
}

function isWorkspaceItemDescendantOf(
	items: WorkspaceItem[],
	input: { ancestorId: string; itemId: string },
) {
	const itemsById = new Map(items.map((item) => [item.id, item]));
	let current = itemsById.get(input.itemId);
	const seen = new Set<string>();

	while (current?.parentId) {
		if (current.parentId === input.ancestorId) {
			return true;
		}

		if (seen.has(current.parentId)) {
			return false;
		}

		seen.add(current.parentId);
		current = itemsById.get(current.parentId);
	}

	return false;
}

export function debugWorkspaceDnd(
	event: string,
	payload?: Record<string, unknown>,
) {
	console.debug(
		`[workspace-dnd] ${JSON.stringify({
			event,
			...normalizeDebugPayload(payload),
		})}`,
	);
}

function normalizeDebugPayload(payload: Record<string, unknown> | undefined) {
	if (!payload) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(payload).map(([key, value]) => [
			key,
			normalizeDebugValue(value),
		]),
	);
}

function normalizeDebugValue(value: unknown): unknown {
	if (typeof value === "bigint") {
		return value.toString();
	}

	if (value instanceof Error) {
		return value.message;
	}

	if (Array.isArray(value)) {
		return value.map(normalizeDebugValue);
	}

	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, nestedValue]) => [
				key,
				normalizeDebugValue(nestedValue),
			]),
		);
	}

	return value;
}
