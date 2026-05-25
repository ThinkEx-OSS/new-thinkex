import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import type { WorkspaceSummary } from "#/features/workspaces/contracts";
import type { WorkspaceDragCommand } from "#/features/workspaces/model/drag";
import {
	getTabViewKey,
	getWorkspaceTabSearch,
	WORKSPACE_ROOT_VIEW,
} from "#/features/workspaces/model/tabs";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import {
	useWorkspaceTabsStore,
	type WorkspaceTab,
} from "#/features/workspaces/state/workspace-tabs-store";

type OpenWorkspaceItemOptions = {
	background?: boolean;
};

interface UseWorkspaceNavigationInput {
	workspace: WorkspaceSummary;
	items: WorkspaceItem[];
	activeTabIdFromUrl?: string;
	activeViewFromUrl?: string;
}

export function useWorkspaceNavigation({
	workspace,
	items,
	activeTabIdFromUrl,
	activeViewFromUrl,
}: UseWorkspaceNavigationInput) {
	const navigate = useNavigate();
	const scopedItems = useMemo(
		() => items.filter((item) => item.workspaceId === workspace.id),
		[items, workspace.id],
	);
	const itemsById = useMemo(
		() => new Map(scopedItems.map((item) => [item.id, item])),
		[scopedItems],
	);
	const session = useWorkspaceTabsStore(
		(state) => state.sessionsByWorkspaceId[workspace.id],
	);
	const ensureWorkspaceSession = useWorkspaceTabsStore(
		(state) => state.ensureWorkspaceSession,
	);
	const createRootTab = useWorkspaceTabsStore((state) => state.createRootTab);
	const createItemTab = useWorkspaceTabsStore((state) => state.createItemTab);
	const replaceTabView = useWorkspaceTabsStore((state) => state.replaceTabView);
	const activateTab = useWorkspaceTabsStore((state) => state.activateTab);
	const reorderTabs = useWorkspaceTabsStore((state) => state.reorderTabs);
	const moveTab = useWorkspaceTabsStore((state) => state.moveTab);
	const closeTab = useWorkspaceTabsStore((state) => state.closeTab);
	const activeTab = session?.tabs.find((tab) => tab.id === session.activeTabId);
	const activeItem = activeTab?.viewItemId
		? itemsById.get(activeTab.viewItemId)
		: undefined;
	const validItemIds = useMemo(() => new Set(itemsById.keys()), [itemsById]);

	const navigateToTab = useCallback(
		(tab: WorkspaceTab, replace = false) => {
			void navigate({
				to: "/workspaces/$workspaceId",
				params: { workspaceId: workspace.id },
				search: getWorkspaceTabSearch(tab),
				replace,
			});
		},
		[navigate, workspace.id],
	);

	const replaceActiveTabView = useCallback(
		(input: { item?: WorkspaceItem; tabId?: string }) =>
			replaceTabView({
				workspaceId: workspace.id,
				tabId: input.tabId ?? activeTab?.id ?? "",
				title: input.item?.name ?? workspace.name,
				viewItemId: input.item?.id,
			}),
		[activeTab?.id, replaceTabView, workspace.id, workspace.name],
	);

	useEffect(() => {
		const nextSession = ensureWorkspaceSession({
			workspaceId: workspace.id,
			workspaceName: workspace.name,
			requestedTabId: activeTabIdFromUrl,
			validItemIds,
		});
		let nextActiveTab =
			nextSession.tabs.find((tab) => tab.id === nextSession.activeTabId) ??
			nextSession.tabs[0];
		const requestedTabExists =
			!activeTabIdFromUrl ||
			nextSession.tabs.some((tab) => tab.id === activeTabIdFromUrl);
		const hasExplicitView = typeof activeViewFromUrl === "string";
		const shouldApplyView = hasExplicitView || Boolean(activeTabIdFromUrl);

		if (shouldApplyView) {
			const requestedItem =
				activeViewFromUrl && activeViewFromUrl !== WORKSPACE_ROOT_VIEW
					? itemsById.get(activeViewFromUrl)
					: undefined;
			const nextViewItemId = hasExplicitView
				? requestedItem?.id
				: nextActiveTab.viewItemId;

			if (nextActiveTab.viewItemId !== nextViewItemId) {
				nextActiveTab = replaceTabView({
					workspaceId: workspace.id,
					tabId: nextActiveTab.id,
					title: requestedItem?.name ?? workspace.name,
					viewItemId: nextViewItemId,
				});
			}
		}

		const shouldReplaceSearch =
			!activeTabIdFromUrl ||
			!requestedTabExists ||
			activeTabIdFromUrl !== nextActiveTab.id ||
			activeViewFromUrl !== getTabViewKey(nextActiveTab);

		if (shouldReplaceSearch) {
			navigateToTab(nextActiveTab, true);
		}
	}, [
		activeTabIdFromUrl,
		activeViewFromUrl,
		ensureWorkspaceSession,
		itemsById,
		navigateToTab,
		replaceTabView,
		validItemIds,
		workspace.id,
		workspace.name,
	]);

	const getInsertIndexAfterActiveTab = () => {
		const activeTabIndex =
			session?.tabs.findIndex((tab) => tab.id === activeTab?.id) ?? -1;

		return activeTabIndex >= 0 ? activeTabIndex + 1 : Number.MAX_SAFE_INTEGER;
	};
	const createWorkspaceTab = () => {
		const tab = createRootTab({
			workspaceId: workspace.id,
			workspaceName: workspace.name,
		});

		navigateToTab(tab);
	};
	const openItemInNewTab = (input: {
		item: WorkspaceItem;
		activate?: boolean;
		insertIndex?: number;
	}) => {
		const tab = createItemTab({
			workspaceId: workspace.id,
			workspaceName: workspace.name,
			itemId: input.item.id,
			title: input.item.name,
			insertIndex: input.insertIndex ?? getInsertIndexAfterActiveTab(),
			activate: input.activate,
		});

		if (input.activate !== false) {
			navigateToTab(tab);
		}

		return tab;
	};
	const activateWorkspaceTab = (tab: WorkspaceTab) => {
		activateTab({ workspaceId: workspace.id, tabId: tab.id });
		navigateToTab(tab);
	};
	const reorderWorkspaceTabs = (activeTabId: string, overTabId: string) => {
		reorderTabs({
			workspaceId: workspace.id,
			activeTabId,
			overTabId,
		});
	};
	const dispatchWorkspaceDragCommand = (command: WorkspaceDragCommand) => {
		switch (command.type) {
			case "move-tab-in-strip":
				moveTab({
					workspaceId: workspace.id,
					tabId: command.tabId,
					toIndex: command.toIndex,
				});
				break;
			case "reorder-tabs-over-tab":
				reorderWorkspaceTabs(command.activeTabId, command.overTabId);
				break;
			case "split-tab":
			case "move-tab-to-pane":
				break;
		}
	};
	const closeWorkspaceTab = (tab: WorkspaceTab) => {
		const nextSession = closeTab({ workspaceId: workspace.id, tabId: tab.id });
		const nextActiveTab =
			nextSession.tabs.find((item) => item.id === nextSession.activeTabId) ??
			nextSession.tabs[0];

		if (nextActiveTab && nextActiveTab.id !== activeTab?.id) {
			navigateToTab(nextActiveTab);
		}
	};
	const openItem = (
		item: WorkspaceItem,
		options?: OpenWorkspaceItemOptions,
	) => {
		if (options?.background) {
			openItemInNewTab({ item, activate: false });
			return;
		}

		if (activeTab?.viewItemId === item.id) {
			return;
		}

		const tab = replaceActiveTabView({ item });

		navigateToTab(tab);
	};
	const openWorkspaceRoot = () => {
		if (!activeTab?.viewItemId) {
			return;
		}

		const tab = replaceActiveTabView({});

		navigateToTab(tab);
	};
	const closeCurrentView = () => {
		if (!activeItem) {
			return;
		}

		const parent = activeItem.parentId
			? itemsById.get(activeItem.parentId)
			: undefined;
		const tab = replaceActiveTabView({ item: parent });

		navigateToTab(tab);
	};

	return {
		activeItem,
		activeTab,
		closeCurrentView,
		closeWorkspaceTab,
		createWorkspaceTab,
		itemsById,
		openItem,
		openItemInNewTab,
		openWorkspaceRoot,
		scopedItems,
		session,
		activateWorkspaceTab,
		dispatchWorkspaceDragCommand,
		reorderWorkspaceTabs,
	};
}
