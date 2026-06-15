import type {
	WorkspaceAiContextItemReference,
	WorkspaceAiContextMarkedItem,
	WorkspaceAiContextPaneReference,
	WorkspaceAiContextPresentationReference,
	WorkspaceAiContextSnapshot,
	WorkspaceAiContextTabReference,
} from "./workspace-ai-context-types";

export function isWorkspaceAiContextSnapshot(
	value: unknown,
): value is WorkspaceAiContextSnapshot {
	if (!isRecord(value)) {
		return false;
	}

	return (
		isRecord(value.workspace) &&
		typeof value.workspace.name === "string" &&
		Array.isArray(value.markedItems) &&
		Array.isArray(value.openTabs) &&
		value.contentIncluded === false &&
		isRecord(value.view) &&
		isWorkspaceAiContextPresentationReference(value.view.presentation)
	);
}

export function isWorkspaceAiContextMarkedItem(
	value: unknown,
): value is WorkspaceAiContextMarkedItem {
	if (!isRecord(value) || !isWorkspaceAiContextItemReference(value)) {
		return false;
	}

	const markedItem = value as WorkspaceAiContextMarkedItem;

	return (
		markedItem.availableToAi === true &&
		markedItem.markedForAiContext === true &&
		typeof markedItem.order === "number" &&
		Number.isInteger(markedItem.order)
	);
}

export function isWorkspaceAiContextTabReference(
	value: unknown,
): value is WorkspaceAiContextTabReference {
	if (!isRecord(value) || !isRecord(value.view)) {
		return false;
	}

	if (typeof value.title !== "string" || typeof value.active !== "boolean") {
		return false;
	}

	if (value.view.kind === "workspace-root") {
		return true;
	}

	if (value.view.kind === "missing-item") {
		return true;
	}

	return (
		value.view.kind === "workspace-item" &&
		isWorkspaceAiContextItemReference(value.view.item)
	);
}

export function isWorkspaceAiContextPresentationReference(
	value: unknown,
): value is WorkspaceAiContextPresentationReference {
	if (!isRecord(value) || typeof value.mode !== "string") {
		return false;
	}

	if (value.mode === "standard") {
		return (
			value.activePane === undefined ||
			isWorkspaceAiContextPaneReference(value.activePane)
		);
	}

	if (value.mode === "maximized") {
		return (
			isWorkspaceAiContextPaneReference(value.activePane) &&
			(value.restoreMode === "standard" || value.restoreMode === "split")
		);
	}

	return (
		value.mode === "split" &&
		(value.direction === "horizontal" || value.direction === "vertical") &&
		Array.isArray(value.panes) &&
		value.panes.every(isWorkspaceAiContextPaneReference) &&
		(value.activePane === undefined ||
			isWorkspaceAiContextPaneReference(value.activePane))
	);
}

function isWorkspaceAiContextItemReference(
	value: unknown,
): value is WorkspaceAiContextItemReference {
	if (!isRecord(value) || !isRecord(value.state)) {
		return false;
	}

	return (
		typeof value.name === "string" &&
		typeof value.path === "string" &&
		typeof value.type === "string" &&
		typeof value.state.activeVisible === "boolean" &&
		Array.isArray(value.state.openInTabs) &&
		value.state.openInTabs.every((tabTitle) => typeof tabTitle === "string")
	);
}

function isWorkspaceAiContextPaneReference(
	value: unknown,
): value is WorkspaceAiContextPaneReference {
	if (!isRecord(value)) {
		return false;
	}

	if (value.kind === "workspace-root" || value.kind === "ai-chat") {
		return true;
	}

	if (value.kind === "missing-item") {
		return true;
	}

	return (
		value.kind === "workspace-item" &&
		isWorkspaceAiContextItemReference(value.item)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
