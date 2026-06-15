import type { WorkspaceTab } from "#/features/workspaces/model/tab-types";
import type {
	WorkspacePane,
	WorkspacePresentation,
} from "#/features/workspaces/state/workspace-ui-store";

import {
	getOpenTabItemIds,
	getWorkspaceAiContextItemReference,
} from "./workspace-ai-context-reference";
import type {
	WorkspaceAiContextPaneReference,
	WorkspaceAiContextPresentationReference,
	WorkspaceAiContextScope,
	WorkspaceAiContextSnapshot,
	WorkspaceAiContextTabReference,
} from "./workspace-ai-context-types";

export function buildWorkspaceAiContextSnapshot(
	context: WorkspaceAiContextScope,
): WorkspaceAiContextSnapshot {
	const openTabItemIds = getOpenTabItemIds(context.tabs);
	const activeItem =
		context.activeItem && context.itemsById.has(context.activeItem.id)
			? context.activeItem
			: undefined;

	return {
		workspace: {
			name: context.workspaceName,
		},
		view: {
			activeItem: activeItem
				? getWorkspaceAiContextItemReference({
						item: activeItem,
						context,
						openTabItemIds,
					})
				: undefined,
			activeTab: getOptionalWorkspaceAiContextTabReference(
				context.tabs.find((tab) => tab.id === context.activeTabId),
				context,
				openTabItemIds,
			),
			presentation: getWorkspaceAiContextPresentationReference(
				context.presentation,
				context,
				openTabItemIds,
			),
		},
		markedItems: context.aiContextItemIds.flatMap((itemId, index) => {
			const item = context.itemsById.get(itemId);

			if (!item) {
				return [];
			}

			return [
				{
					...getWorkspaceAiContextItemReference({
						item,
						context,
						openTabItemIds,
					}),
					availableToAi: true as const,
					markedForAiContext: true as const,
					order: index + 1,
				},
			];
		}),
		openTabs: context.tabs.map((tab) =>
			getWorkspaceAiContextTabReference(tab, context, openTabItemIds),
		),
		contentIncluded: false,
	};
}

function getOptionalWorkspaceAiContextTabReference(
	tab: WorkspaceTab | undefined,
	context: WorkspaceAiContextScope,
	openTabItemIds: ReadonlyMap<string, string[]>,
) {
	if (!tab) {
		return undefined;
	}

	return getWorkspaceAiContextTabReference(tab, context, openTabItemIds);
}

function getWorkspaceAiContextTabReference(
	tab: WorkspaceTab,
	context: WorkspaceAiContextScope,
	openTabItemIds: ReadonlyMap<string, string[]>,
): WorkspaceAiContextTabReference {
	return {
		title: tab.title,
		active: tab.id === context.activeTabId,
		view: getWorkspaceAiContextTabView(tab, context, openTabItemIds),
	};
}

function getWorkspaceAiContextTabView(
	tab: WorkspaceTab,
	context: WorkspaceAiContextScope,
	openTabItemIds: ReadonlyMap<string, string[]>,
): WorkspaceAiContextTabReference["view"] {
	if (!tab.viewItemId) {
		return { kind: "workspace-root" };
	}

	const item = context.itemsById.get(tab.viewItemId);

	if (!item) {
		return { kind: "missing-item" };
	}

	return {
		kind: "workspace-item",
		item: getWorkspaceAiContextItemReference({
			item,
			context,
			openTabItemIds,
		}),
	};
}

function getWorkspaceAiContextPresentationReference(
	presentation: WorkspacePresentation,
	context: WorkspaceAiContextScope,
	openTabItemIds: ReadonlyMap<string, string[]>,
): WorkspaceAiContextPresentationReference {
	if (presentation.mode === "standard") {
		return {
			mode: "standard",
			activePane: getCurrentWorkspacePaneReference(context, openTabItemIds),
		};
	}

	if (presentation.mode === "maximized") {
		return {
			mode: "maximized",
			activePane: getWorkspaceAiContextPaneReference(
				presentation.pane,
				context,
				openTabItemIds,
			),
			restoreMode: presentation.restorePresentation.mode,
		};
	}

	const panes = presentation.panes.map((pane) =>
		getWorkspaceAiContextPaneReference(pane, context, openTabItemIds),
	);
	const activePaneIndex = presentation.panes.findIndex(
		(pane) => pane.id === presentation.activePaneId,
	);

	return {
		mode: "split",
		direction: presentation.direction,
		activePane: panes[activePaneIndex],
		panes,
	};
}

function getCurrentWorkspacePaneReference(
	context: WorkspaceAiContextScope,
	openTabItemIds: ReadonlyMap<string, string[]>,
): WorkspaceAiContextPaneReference {
	if (!context.activeItem) {
		return { kind: "workspace-root" };
	}

	return {
		kind: "workspace-item",
		item: getWorkspaceAiContextItemReference({
			context,
			item: context.activeItem,
			openTabItemIds,
		}),
	};
}

function getWorkspaceAiContextPaneReference(
	pane: WorkspacePane,
	context: WorkspaceAiContextScope,
	openTabItemIds: ReadonlyMap<string, string[]>,
): WorkspaceAiContextPaneReference {
	if (pane.kind === "chat") {
		return { kind: "ai-chat" };
	}

	if (pane.kind === "root") {
		return { kind: "workspace-root" };
	}

	const item = context.itemsById.get(pane.itemId);

	if (!item) {
		return { kind: "missing-item" };
	}

	return {
		kind: "workspace-item",
		item: getWorkspaceAiContextItemReference({ context, item, openTabItemIds }),
	};
}
