import { normalizeWorkspaceTabSession } from "#/features/workspaces/model/tab-state";
import {
	findItemForTab,
	getActiveWorkspaceTab,
	getWorkspaceTabSearch,
	getWorkspaceTabViewUpdate,
	getWorkspaceTabViewUpdateFromSearch,
	type WorkspaceTabSearch,
	type WorkspaceTabViewUpdate,
} from "#/features/workspaces/model/tabs";
import type { WorkspaceTab, WorkspaceTabSession } from "#/features/workspaces/model/tab-types";
import type { WorkspaceItem } from "#/features/workspaces/model/types";

interface ResolveWorkspaceRouteSessionInput {
	session: WorkspaceTabSession | undefined;
	workspaceName: string;
	itemsById: Map<string, WorkspaceItem>;
	validItemIds: ReadonlySet<string>;
	requestedTabId?: string;
	requestedView?: string;
}

interface ResolveWorkspaceRouteSessionResult {
	normalizedSession: WorkspaceTabSession;
	resolvedActiveTab: WorkspaceTab;
	canonicalSearch: WorkspaceTabSearch;
	shouldActivateTab: boolean;
	tabViewUpdate?: WorkspaceTabViewUpdate;
}

export function resolveWorkspaceRouteSession(
	input: ResolveWorkspaceRouteSessionInput,
): ResolveWorkspaceRouteSessionResult {
	const normalizedSession = normalizeWorkspaceTabSession(
		input.session,
		input.workspaceName,
		input.validItemIds,
	);
	const requestedTab = input.requestedTabId
		? normalizedSession.tabs.find((tab) => tab.id === input.requestedTabId)
		: undefined;
	const activeTab =
		requestedTab ?? getActiveWorkspaceTab(normalizedSession) ?? normalizedSession.tabs[0];

	if (!activeTab) {
		throw new Error("Workspace session must contain at least one tab.");
	}

	const tabViewUpdate = getRouteTabViewUpdate({
		activeTab,
		itemsById: input.itemsById,
		requestedTabId: input.requestedTabId,
		requestedView: input.requestedView,
		workspaceName: input.workspaceName,
	});
	const nextTabViewUpdate =
		tabViewUpdate && isTabViewChanged(activeTab, tabViewUpdate) ? tabViewUpdate : undefined;
	const resolvedActiveTab = nextTabViewUpdate
		? {
				...activeTab,
				title: nextTabViewUpdate.title,
				viewItemId: nextTabViewUpdate.viewItemId,
			}
		: activeTab;

	return {
		normalizedSession,
		resolvedActiveTab,
		canonicalSearch: getWorkspaceTabSearch(resolvedActiveTab),
		shouldActivateTab:
			Boolean(requestedTab) &&
			normalizedSession.activeTabId !== resolvedActiveTab.id &&
			!nextTabViewUpdate,
		tabViewUpdate: nextTabViewUpdate,
	};
}

function getRouteTabViewUpdate(input: {
	activeTab: WorkspaceTab;
	itemsById: Map<string, WorkspaceItem>;
	requestedTabId?: string;
	requestedView?: string;
	workspaceName: string;
}) {
	const hasExplicitView = typeof input.requestedView === "string";

	if (!hasExplicitView && !input.requestedTabId) {
		return undefined;
	}

	if (hasExplicitView) {
		return getWorkspaceTabViewUpdateFromSearch({
			view: input.requestedView,
			itemsById: input.itemsById,
			workspaceName: input.workspaceName,
		});
	}

	return getWorkspaceTabViewUpdate({
		workspaceName: input.workspaceName,
		item: findItemForTab(input.activeTab, input.itemsById),
	});
}

function isTabViewChanged(tab: WorkspaceTab, viewUpdate: WorkspaceTabViewUpdate) {
	return tab.title !== viewUpdate.title || tab.viewItemId !== viewUpdate.viewItemId;
}
