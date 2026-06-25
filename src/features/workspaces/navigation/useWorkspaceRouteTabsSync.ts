import { useEffect } from "react";
import type { WorkspaceSummary } from "#/features/workspaces/contracts";
import type { WorkspaceTab } from "#/features/workspaces/model/tab-types";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { resolveWorkspaceRouteSession } from "#/features/workspaces/navigation/resolve-workspace-route-session";
import { useWorkspaceTabsStore } from "#/features/workspaces/state/workspace-tabs-store";

type UseWorkspaceRouteTabsSyncInput = {
	workspace: WorkspaceSummary;
	itemsById: Map<string, WorkspaceItem>;
	validItemIds: ReadonlySet<string>;
	activeTabIdFromUrl?: string;
	activeViewFromUrl?: string;
	navigateToTab: (tab: WorkspaceTab, replace?: boolean) => void;
};

export function useWorkspaceRouteTabsSync({
	workspace,
	itemsById,
	validItemIds,
	activeTabIdFromUrl,
	activeViewFromUrl,
	navigateToTab,
}: UseWorkspaceRouteTabsSyncInput) {
	const ensureWorkspaceSession = useWorkspaceTabsStore((state) => state.ensureWorkspaceSession);
	const activateTab = useWorkspaceTabsStore((state) => state.activateTab);
	const getSession = useWorkspaceTabsStore((state) => state.getSession);
	const replaceTabView = useWorkspaceTabsStore((state) => state.replaceTabView);

	useEffect(() => {
		const normalizedSession = ensureWorkspaceSession({
			workspaceId: workspace.id,
			workspaceName: workspace.name,
			validItemIds,
		});
		const resolution = resolveWorkspaceRouteSession({
			session: normalizedSession,
			workspaceName: workspace.name,
			itemsById,
			validItemIds,
			requestedTabId: activeTabIdFromUrl,
			requestedView: activeViewFromUrl,
		});

		if (resolution.tabViewUpdate) {
			replaceTabView({
				workspaceId: workspace.id,
				tabId: resolution.resolvedActiveTab.id,
				...resolution.tabViewUpdate,
			});
		} else if (resolution.shouldActivateTab) {
			activateTab({
				workspaceId: workspace.id,
				tabId: resolution.resolvedActiveTab.id,
			});
		}

		const currentSession = getSession(workspace.id);
		const currentActiveTab = currentSession?.tabs.find(
			(tab) => tab.id === currentSession.activeTabId,
		);
		const shouldReplaceSearch =
			activeTabIdFromUrl !== resolution.canonicalSearch.tab ||
			activeViewFromUrl !== resolution.canonicalSearch.view;

		if (!currentActiveTab || shouldReplaceSearch) {
			navigateToTab(resolution.resolvedActiveTab, true);
		}
	}, [
		activateTab,
		activeTabIdFromUrl,
		activeViewFromUrl,
		ensureWorkspaceSession,
		getSession,
		itemsById,
		navigateToTab,
		replaceTabView,
		validItemIds,
		workspace.id,
		workspace.name,
	]);
}
