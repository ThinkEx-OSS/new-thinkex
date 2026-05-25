import { move } from "@dnd-kit/helpers";
import type { DragDropEventHandlers } from "@dnd-kit/react";

import type { ReorderWorkspaceItemsInput } from "#/features/workspaces/contracts";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import {
	arraysEqual,
	getWorkspaceItemOrderScopeKey,
	haveSameIds,
} from "#/features/workspaces/workspace-item-ordering";

import {
	getWorkspaceDragSource,
	getWorkspaceDropTarget,
	getWorkspaceItemTabInsertMatch,
} from "./drag-targets";
import type {
	WorkspaceDragCommand,
	WorkspaceDragEndEvent,
	WorkspaceDragIntent,
	WorkspaceItemMoveResolution,
} from "./drag-types";

export type DndDragEndEvent = Parameters<
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

	const dragSource = getWorkspaceDragSource(source);

	if (dragSource?.kind !== "tab") {
		return undefined;
	}

	if (
		typeof source.index === "number" &&
		typeof source.initialIndex === "number" &&
		source.index !== source.initialIndex
	) {
		return {
			type: "move-tab-in-strip",
			tabId: dragSource.tabId,
			toIndex: source.index,
		};
	}

	const dropTarget = getWorkspaceDropTarget(target);

	if (dropTarget?.kind === "tab") {
		return {
			type: "reorder-tabs-over-tab",
			activeTabId: dragSource.tabId,
			overTabId: dropTarget.tabId,
		};
	}

	return undefined;
}

export function getWorkspaceDragIntent(input: {
	event: DndDragEndEvent;
	items: WorkspaceItem[];
	orderRef: Map<string, string[]>;
	workspaceId: string;
}): WorkspaceDragIntent | undefined {
	const { event, items, orderRef, workspaceId } = input;
	const command = getWorkspaceDragCommand(event);

	// Add pane/chat commit intents here as those surfaces move from projection stubs to real workspace behavior.
	if (command?.type === "move-tab-in-strip") {
		return {
			kind: "move-tab-in-strip",
			tabId: command.tabId,
			toIndex: command.toIndex,
		};
	}

	if (command?.type === "reorder-tabs-over-tab") {
		return {
			kind: "reorder-tabs-over-tab",
			activeTabId: command.activeTabId,
			overTabId: command.overTabId,
		};
	}

	const tabInsertInput = getWorkspaceItemTabInsertInput({ event, items });

	if (tabInsertInput) {
		return {
			kind: "open-item-tab",
			item: tabInsertInput.item,
			insertIndex: tabInsertInput.insertIndex,
		};
	}

	const moveResolution = getWorkspaceItemMoveResolution({
		event,
		items,
		workspaceId,
	});

	if (moveResolution?.kind === "blocked") {
		return {
			kind: "move-item-blocked",
			resolution: moveResolution,
		};
	}

	if (moveResolution?.kind === "move") {
		return {
			kind: "move-item",
			resolution: moveResolution,
		};
	}

	const reorderInput = getWorkspaceItemReorderInput({
		event,
		items,
		orderRef,
		workspaceId,
	});

	if (reorderInput) {
		return {
			kind: "reorder-item",
			orderScopeKey: reorderInput.orderScopeKey,
			mutationInput: reorderInput.mutationInput,
		};
	}

	return undefined;
}

export function getWorkspaceItemTabInsertInput(input: {
	event: DndDragEndEvent;
	items: WorkspaceItem[];
}):
	| {
			item: WorkspaceItem;
			insertIndex: number;
	  }
	| undefined {
	const { event, items } = input;
	const { source, target } = event.operation;
	const canceled = event.canceled ?? event.operation.canceled;
	const match = getWorkspaceItemTabInsertMatch({ source, target });

	if (canceled || !match) {
		return undefined;
	}

	const item = items.find((candidate) => candidate.id === match.source.itemId);

	if (!item) {
		return undefined;
	}

	return {
		item,
		insertIndex: match.insertIndex,
	};
}

export function shouldPreventWorkspaceItemOptimisticSorting(
	event: WorkspaceDragEndEvent,
) {
	const { source, target } = event.operation;
	const dragSource = getWorkspaceDragSource(source);
	const dropTarget = getWorkspaceDropTarget(target);

	if (
		dragSource?.kind !== "workspace-item" ||
		dropTarget?.kind !== "workspace-item"
	) {
		return false;
	}

	return dragSource.row !== dropTarget.row;
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

export function getWorkspaceItemMoveResolution(input: {
	event: DndDragEndEvent;
	items: WorkspaceItem[];
	workspaceId: string;
}): WorkspaceItemMoveResolution | undefined {
	const { event, items, workspaceId } = input;
	const { source } = event.operation;
	const canceled = event.canceled ?? event.operation.canceled;
	const dragSource = getWorkspaceDragSource(source);
	const dropTarget = getWorkspaceDropTarget(event.operation.target);
	const targetFolderId =
		dropTarget?.kind === "workspace-folder" ? dropTarget.folderId : undefined;

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

	const sourceItem =
		dragSource?.kind === "workspace-item"
			? items.find((item) => item.id === dragSource.itemId)
			: undefined;
	const targetFolder = items.find((item) => item.id === targetFolderId);

	if (dragSource?.kind !== "workspace-item" || !sourceItem) {
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
			row: dragSource.row,
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
	const dragSource = getWorkspaceDragSource(source);
	const dropTarget = getWorkspaceDropTarget(target);

	if (
		canceled ||
		dragSource?.kind !== "workspace-item" ||
		dropTarget?.kind !== "workspace-item" ||
		dragSource.row !== dropTarget.row
	) {
		return undefined;
	}

	const movedItemId = dragSource.itemId;
	const movedItem = items.find((item) => item.id === movedItemId);

	if (!movedItem) {
		return undefined;
	}

	const siblings = items.filter(
		(item) =>
			item.parentId === movedItem.parentId &&
			(dragSource.row === "folder"
				? item.type === "folder"
				: item.type !== "folder"),
	);
	const siblingItemIds = siblings.map((item) => item.id);
	const orderScopeKey = getWorkspaceItemOrderScopeKey({
		workspaceId,
		parentId: movedItem.parentId,
		row: dragSource.row,
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
			row: dragSource.row,
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
