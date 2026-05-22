import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import AiChatPanel, {
	AiChatPanelMaximized,
} from "#/components/workspace/AiChatPanel";
import type { WorkspaceItem } from "#/components/workspace/types";
import WorkspaceContent from "#/components/workspace/WorkspaceContent";
import WorkspaceTopBar from "#/components/workspace/WorkspaceTopBar";
import type { WorkspaceSummary } from "#/lib/api/contracts";
import { getTabViewKey, getWorkspaceTabSearch } from "#/lib/workspace-tabs";
import { useAiChatPanelStore } from "#/stores/ai-chat-panel";
import {
	useWorkspaceTabsStore,
	type WorkspaceTab,
} from "#/stores/workspace-tabs";

export type { WorkspaceItem } from "#/components/workspace/types";

interface WorkspaceShellProps {
	workspace: WorkspaceSummary;
	items: WorkspaceItem[];
	activeTabIdFromUrl?: string;
	activeViewFromUrl?: string;
}

export function WorkspaceShell({
	workspace,
	items,
	activeTabIdFromUrl,
	activeViewFromUrl,
}: WorkspaceShellProps) {
	const navigate = useNavigate();
	const itemsById = useMemo(
		() => new Map(items.map((item) => [item.id, item])),
		[items],
	);
	const isCollapsed = useAiChatPanelStore((state) => state.isCollapsed);
	const isMaximized = useAiChatPanelStore((state) => state.isMaximized);
	const session = useWorkspaceTabsStore(
		(state) => state.sessionsByWorkspaceId[workspace.id],
	);
	const ensureWorkspaceSession = useWorkspaceTabsStore(
		(state) => state.ensureWorkspaceSession,
	);
	const createRootTab = useWorkspaceTabsStore((state) => state.createRootTab);
	const replaceTabWithItem = useWorkspaceTabsStore(
		(state) => state.replaceTabWithItem,
	);
	const replaceTabWithRoot = useWorkspaceTabsStore(
		(state) => state.replaceTabWithRoot,
	);
	const activateTab = useWorkspaceTabsStore((state) => state.activateTab);
	const closeTab = useWorkspaceTabsStore((state) => state.closeTab);
	const activeTab = session?.tabs.find((tab) => tab.id === session.activeTabId);

	useEffect(() => {
		const nextSession = ensureWorkspaceSession({
			workspaceId: workspace.id,
			workspaceName: workspace.name,
			requestedTabId: activeTabIdFromUrl,
		});
		let nextActiveTab =
			nextSession.tabs.find((tab) => tab.id === nextSession.activeTabId) ??
			nextSession.tabs[0];
		const requestedTabExists =
			!activeTabIdFromUrl ||
			nextSession.tabs.some((tab) => tab.id === activeTabIdFromUrl);
		const shouldApplyView = !activeTabIdFromUrl || requestedTabExists;

		if (
			shouldApplyView &&
			activeViewFromUrl === "root" &&
			nextActiveTab.kind !== "root"
		) {
			nextActiveTab = replaceTabWithRoot({
				workspaceId: workspace.id,
				tabId: nextActiveTab.id,
				workspaceName: workspace.name,
			});
		} else if (
			shouldApplyView &&
			activeViewFromUrl &&
			activeViewFromUrl !== "root"
		) {
			const item = itemsById.get(activeViewFromUrl);

			if (
				item &&
				(nextActiveTab.kind !== "item" || nextActiveTab.itemId !== item.id)
			) {
				nextActiveTab = replaceTabWithItem({
					workspaceId: workspace.id,
					tabId: nextActiveTab.id,
					itemId: item.id,
					itemTitle: item.title,
				});
			}
		}

		const shouldReplaceSearch =
			!activeTabIdFromUrl ||
			!requestedTabExists ||
			activeTabIdFromUrl !== nextActiveTab.id ||
			activeViewFromUrl !== getTabViewKey(nextActiveTab);

		if (!shouldReplaceSearch) {
			return;
		}

		navigate({
			to: "/workspaces/$workspaceId",
			params: { workspaceId: workspace.id },
			search: getWorkspaceTabSearch(nextActiveTab),
			replace: true,
		});
	}, [
		activeTabIdFromUrl,
		activeViewFromUrl,
		ensureWorkspaceSession,
		itemsById,
		navigate,
		replaceTabWithItem,
		replaceTabWithRoot,
		workspace.id,
		workspace.name,
	]);

	if (!session || !activeTab) {
		return <div className="min-h-screen bg-background text-foreground" />;
	}

	const navigateToTab = (tab: WorkspaceTab, replace = false) => {
		navigate({
			to: "/workspaces/$workspaceId",
			params: { workspaceId: workspace.id },
			search: getWorkspaceTabSearch(tab),
			replace,
		});
	};
	const handleCreateRootTab = () => {
		const tab = createRootTab({
			workspaceId: workspace.id,
			workspaceName: workspace.name,
		});

		navigateToTab(tab);
	};
	const handleActivateTab = (tab: WorkspaceTab) => {
		activateTab({ workspaceId: workspace.id, tabId: tab.id });
		navigateToTab(tab);
	};
	const handleCloseTab = (tab: WorkspaceTab) => {
		const nextSession = closeTab({ workspaceId: workspace.id, tabId: tab.id });
		const nextActiveTab =
			nextSession.tabs.find((item) => item.id === nextSession.activeTabId) ??
			nextSession.tabs[0];

		if (nextActiveTab && nextActiveTab.id !== activeTab.id) {
			navigateToTab(nextActiveTab);
		}
	};
	const handleOpenItem = (item: WorkspaceItem) => {
		const tab = replaceTabWithItem({
			workspaceId: workspace.id,
			tabId: activeTab.id,
			itemId: item.id,
			itemTitle: item.title,
		});

		navigateToTab(tab);
	};

	return (
		<div className="min-h-screen bg-background text-foreground">
			{isMaximized ? <AiChatPanelMaximized /> : null}

			<Group
				id="workspace-layout"
				orientation="horizontal"
				className="min-h-screen"
				resizeTargetMinimumSize={{ coarse: 37, fine: 27 }}
			>
				<Panel id="workspace" minSize="45%">
					<div className="min-h-screen min-w-0">
						<WorkspaceTopBar
							workspace={workspace}
							itemsById={itemsById}
							tabs={session.tabs}
							activeTab={activeTab}
							onActivateTab={handleActivateTab}
							onCloseTab={handleCloseTab}
							onCreateRootTab={handleCreateRootTab}
						/>
						<WorkspaceContent
							items={items}
							itemsById={itemsById}
							activeTab={activeTab}
							onOpenItem={handleOpenItem}
						/>
					</div>
				</Panel>

				{isCollapsed ? null : (
					<>
						<Separator
							id="workspace-ai-chat-separator"
							className="relative z-[45] -mx-[13px] hidden w-[27px] items-stretch justify-center outline-none [&[data-separator=active]>div]:w-[3px] [&[data-separator=active]>div]:bg-ring [&[data-separator=hover]>div]:w-[3px] [&[data-separator=hover]>div]:bg-ring/70 lg:flex"
							onPointerUp={(event) => event.currentTarget.blur()}
						>
							<div className="my-0 w-px bg-border transition-[background-color,width] duration-150" />
						</Separator>
						<Panel
							id="ai-chat"
							defaultSize="30rem"
							minSize="26rem"
							maxSize="60%"
							className="hidden lg:block"
						>
							<AiChatPanel />
						</Panel>
					</>
				)}
			</Group>
		</div>
	);
}
