import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
	applyWorkspaceEventToCache,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import AiChatPanel from "#/features/workspaces/components/AiChatPanel";
import WorkspaceContent from "#/features/workspaces/components/WorkspaceContent";
import WorkspaceContextBar from "#/features/workspaces/components/WorkspaceContextBar";
import WorkspaceDragProvider from "#/features/workspaces/components/WorkspaceDragProvider";
import WorkspaceFrame from "#/features/workspaces/components/WorkspaceFrame";
import {
	hasWorkspacePaneKind,
	WorkspaceMaximizedPresentation,
	WorkspacePaneRenderer,
	WorkspaceSplitPresentation,
} from "#/features/workspaces/components/WorkspacePresentation";
import {
	WorkspaceSkeletonAiChatPanel,
	WorkspaceSkeletonChrome,
	WorkspaceSkeletonContent,
} from "#/features/workspaces/components/WorkspaceShellSkeleton";
import WorkspaceTopBar from "#/features/workspaces/components/WorkspaceTopBar";
import type {
	WorkspaceItemType,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { isWorkspaceItemView } from "#/features/workspaces/model/view";
import { useWorkspaceNavigation } from "#/features/workspaces/navigation/useWorkspaceNavigation";
import { useWorkspaceRealtime } from "#/features/workspaces/realtime/use-workspace-presence";
import { useWorkspacePersistedStoresHydrated } from "#/features/workspaces/state/persisted-store-hydration";
import {
	selectWorkspaceUiSession,
	useWorkspaceUiStore,
} from "#/features/workspaces/state/workspace-ui-store";
import { shouldIgnoreWorkspaceClientMutationEcho } from "#/features/workspaces/use-workspace-client-mutation-echo";
import {
	useCreateWorkspaceItemMutation,
	useMoveWorkspaceItemMutation,
} from "#/features/workspaces/use-workspace-kernel-items";
import { useAppHotkey } from "#/lib/hotkeys-core";

export type { WorkspaceItem } from "#/features/workspaces/model/types";

interface WorkspaceShellProps {
	workspace: WorkspaceSummary;
	items: WorkspaceItem[];
	revision: number;
	activeTabIdFromUrl?: string;
	activeViewFromUrl?: string;
}

export function WorkspaceShell({
	workspace,
	items,
	revision,
	activeTabIdFromUrl,
	activeViewFromUrl,
}: WorkspaceShellProps) {
	const queryClient = useQueryClient();
	const createWorkspaceItemMutation = useCreateWorkspaceItemMutation();
	const moveWorkspaceItemMutation = useMoveWorkspaceItemMutation();
	const persistedStoresHydrated = useWorkspacePersistedStoresHydrated();
	const ensureWorkspaceUiSession = useWorkspaceUiStore(
		(state) => state.ensureWorkspaceSession,
	);
	const toggleChatPanelCollapsed = useWorkspaceUiStore(
		(state) => state.toggleChatPanelCollapsed,
	);
	const realtime = useWorkspaceRealtime({
		workspaceId: workspace.id,
		lastSeenRevision: revision,
		onEvent: (event) => {
			if (shouldIgnoreWorkspaceClientMutationEcho(event)) {
				return;
			}
			applyWorkspaceEventToCache(queryClient, event);
		},
		onReconnect: () => {
			queryClient.invalidateQueries({
				queryKey: workspacePageQueryKey(workspace.id),
			});
		},
		onRevisionGap: () => {
			queryClient.invalidateQueries({
				queryKey: workspacePageQueryKey(workspace.id),
			});
		},
	});
	const {
		activeItem,
		activeTab,
		activateWorkspaceTab,
		closeItemView,
		closeOtherWorkspaceTabs,
		closeWorkspaceTab,
		closeWorkspaceTabsToRight,
		createWorkspaceTab,
		createWorkspaceTabAfter,
		dispatchWorkspaceDragCommand,
		duplicateWorkspaceTab,
		itemsById,
		openItem,
		openItemInNewTab,
		openWorkspaceRoot,
		scopedItems,
		session,
		validItemIds,
	} = useWorkspaceNavigation({
		workspace,
		items,
		activeTabIdFromUrl,
		activeViewFromUrl,
	});
	const normalizedUiSession = useWorkspaceUiStore(
		selectWorkspaceUiSession(workspace.id),
	);
	const { chatPanelCollapsed, presentation } = normalizedUiSession;
	const presentationHasChat = hasWorkspacePaneKind(presentation, "chat");
	const createWorkspaceItem = (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => {
		createWorkspaceItemMutation.mutate({
			id: crypto.randomUUID(),
			workspaceId: workspace.id,
			parentId: input.parentId,
			type: input.type,
		});
	};

	useEffect(() => {
		ensureWorkspaceUiSession({
			workspaceId: workspace.id,
			validItemIds,
		});
	}, [ensureWorkspaceUiSession, validItemIds, workspace.id]);
	useAppHotkey("workspace.aiChat.toggle", () => {
		toggleChatPanelCollapsed(workspace.id);
	});

	if (!persistedStoresHydrated || !session || !activeTab) {
		return (
			<WorkspaceFrame
				chrome={<WorkspaceSkeletonChrome />}
				content={<WorkspaceSkeletonContent />}
				chatPanel={<WorkspaceSkeletonAiChatPanel />}
			/>
		);
	}

	if (presentation.mode === "maximized") {
		return (
			<WorkspaceMaximizedPresentation>
				<WorkspacePaneRenderer
					workspaceId={workspace.id}
					pane={presentation.pane}
					itemsById={itemsById}
					scopedItems={scopedItems}
					onCreateItem={createWorkspaceItem}
					onOpenItem={openItem}
				/>
			</WorkspaceMaximizedPresentation>
		);
	}

	return (
		<WorkspaceDragProvider
			items={scopedItems}
			workspaceId={workspace.id}
			onMoveItem={moveWorkspaceItemMutation.mutate}
			onOpenItemInNewTab={openItemInNewTab}
			onWorkspaceDragCommand={dispatchWorkspaceDragCommand}
		>
			<WorkspaceFrame
				chrome={
					<WorkspaceTopBar
						workspace={workspace}
						itemsById={itemsById}
						tabs={session.tabs}
						activeTab={activeTab}
						contextBar={
							<WorkspaceContextBar
								workspace={workspace}
								activeItem={activeItem}
								itemsById={itemsById}
								onCreateItem={createWorkspaceItem}
								onCloseItemView={
									isWorkspaceItemView(activeItem) ? closeItemView : undefined
								}
								onNavigateToRoot={openWorkspaceRoot}
								onNavigateToItem={openItem}
							/>
						}
						presence={realtime}
						onActivateTab={activateWorkspaceTab}
						onCloseTab={closeWorkspaceTab}
						onCloseOtherTabs={closeOtherWorkspaceTabs}
						onCloseTabsToRight={closeWorkspaceTabsToRight}
						onCreateRootTab={createWorkspaceTab}
						onCreateRootTabAfter={createWorkspaceTabAfter}
						onDuplicateTab={duplicateWorkspaceTab}
					/>
				}
				content={
					presentation.mode === "split" ? (
						<WorkspaceSplitPresentation
							workspaceId={workspace.id}
							panes={presentation.panes}
							direction={presentation.direction}
							itemsById={itemsById}
							scopedItems={scopedItems}
							onCreateItem={createWorkspaceItem}
							onOpenItem={openItem}
						/>
					) : (
						<WorkspaceContent
							items={scopedItems}
							activeItem={activeItem}
							onCreateItem={createWorkspaceItem}
							onOpenItem={openItem}
						/>
					)
				}
				chatPanel={
					chatPanelCollapsed || presentationHasChat ? undefined : (
						<AiChatPanel workspaceId={workspace.id} />
					)
				}
			/>
		</WorkspaceDragProvider>
	);
}
