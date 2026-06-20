import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
	applyWorkspaceEventToCache,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import AiChatPanel from "#/features/workspaces/components/AiChatPanel";
import WorkspaceContextBar from "#/features/workspaces/components/WorkspaceContextBar";
import WorkspaceDragProvider from "#/features/workspaces/components/WorkspaceDragProvider";
import { WorkspaceFileUploadProvider } from "#/features/workspaces/components/WorkspaceFileUploadProvider";
import WorkspaceFrame from "#/features/workspaces/components/WorkspaceFrame";
import { WorkspaceItemToolbarProvider } from "#/features/workspaces/components/WorkspaceItemToolbarSlot";
import WorkspacePaneRenderer from "#/features/workspaces/components/WorkspacePaneRenderer";
import { WorkspacePdfEngineProvider } from "#/features/workspaces/components/WorkspacePdfEngineProvider";
import { WorkspaceMaximizedPresentation } from "#/features/workspaces/components/WorkspacePresentation";
import {
	WorkspaceSkeletonAiChatPanel,
	WorkspaceSkeletonChrome,
	WorkspaceSkeletonContent,
} from "#/features/workspaces/components/WorkspaceShellSkeleton";
import WorkspaceSplitPresentation from "#/features/workspaces/components/WorkspaceSplitPresentation";
import WorkspaceStandardTabPanes from "#/features/workspaces/components/WorkspaceStandardTabPanes";
import WorkspaceTopBar from "#/features/workspaces/components/WorkspaceTopBar";
import { WorkspaceMutationAccessProvider } from "#/features/workspaces/components/workspace-mutation-access";
import { hasWorkspacePaneKind } from "#/features/workspaces/components/workspace-presentation-model";
import type {
	WorkspaceItemType,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { isWorkspaceItemView } from "#/features/workspaces/model/view";
import { workspaceItemRequiresHeavyViewerRuntime } from "#/features/workspaces/model/workspace-file";
import { useWorkspaceNavigation } from "#/features/workspaces/navigation/useWorkspaceNavigation";
import { useWorkspaceRealtime } from "#/features/workspaces/realtime/use-workspace-presence";
import { useWorkspacePersistedStoresHydrated } from "#/features/workspaces/state/persisted-store-hydration";
import { useWorkspaceAiComposerDraftQuotes } from "#/features/workspaces/state/workspace-ai-composer-draft-store";
import {
	useWorkspaceSelectionItemIds,
	useWorkspaceSelectionStore,
} from "#/features/workspaces/state/workspace-selection-store";
import {
	useWorkspaceItemViewStates,
	useWorkspaceUiSession,
	useWorkspaceUiStore,
} from "#/features/workspaces/state/workspace-ui-store";
import { shouldIgnoreWorkspaceClientMutationEcho } from "#/features/workspaces/use-workspace-client-mutation-echo";
import {
	useCreateWorkspaceItemMutation,
	useMoveWorkspaceItemsMutation,
} from "#/features/workspaces/use-workspace-kernel-items";
import { getWorkspaceMemberCapabilities } from "#/features/workspaces/workspace-member-capabilities";
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
	const moveWorkspaceItemsMutation = useMoveWorkspaceItemsMutation();
	const persistedStoresHydrated = useWorkspacePersistedStoresHydrated();
	const ensureWorkspaceUiSession = useWorkspaceUiStore(
		(state) => state.ensureWorkspaceSession,
	);
	const addAiContextItems = useWorkspaceUiStore(
		(state) => state.addAiContextItems,
	);
	const itemViewStatesByItemId = useWorkspaceItemViewStates(workspace.id);
	const selectedQuotes = useWorkspaceAiComposerDraftQuotes(workspace.id);
	const clearSelection = useWorkspaceSelectionStore(
		(state) => state.clearSelection,
	);
	const selectedItemIds = useWorkspaceSelectionItemIds(workspace.id);
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
	const normalizedUiSession = useWorkspaceUiSession(workspace.id);
	const { chatPanelCollapsed, presentation } = normalizedUiSession;
	const presentationHasChat = hasWorkspacePaneKind(presentation, "chat");
	const hasHeavyViewerRuntimeItems = scopedItems.some(
		workspaceItemRequiresHeavyViewerRuntime,
	);
	const addItemsToAiContext = (itemsToAdd: WorkspaceItem[]) => {
		addAiContextItems(
			workspace.id,
			itemsToAdd.map((item) => item.id),
		);
	};
	const addItemIdsToAiContext = (input: {
		clearSelection: boolean;
		itemIds: string[];
	}) => {
		addAiContextItems(workspace.id, input.itemIds);

		if (input.clearSelection) {
			clearSelection({ workspaceId: workspace.id });
		}
	};
	const createWorkspaceItem = (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => {
		if (
			!getWorkspaceMemberCapabilities(workspace.membershipRole).canMutateContent
		) {
			return;
		}

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

	const aiContextScope = {
		activeItem: isWorkspaceItemView(activeItem) ? activeItem : undefined,
		activeTabId: activeTab.id,
		itemViewStatesByItemId,
		aiContextItemIds: normalizedUiSession.aiContextItemIds,
		itemsById,
		presentation,
		selectedQuotes,
		tabs: session.tabs,
		workspaceId: workspace.id,
		workspaceName: workspace.name,
	};

	const presentationContent =
		presentation.mode === "maximized" ? (
			<WorkspaceMaximizedPresentation>
				<WorkspacePaneRenderer
					aiContextScope={aiContextScope}
					pane={presentation.pane}
					scopedItems={scopedItems}
					workspace={workspace}
					onAddItemsToAiContext={addItemsToAiContext}
					onCreateItem={createWorkspaceItem}
					onOpenItem={openItem}
				/>
			</WorkspaceMaximizedPresentation>
		) : (
			<WorkspaceItemToolbarProvider>
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
									toolbarSlotId={activeTab.id}
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
								aiContextScope={aiContextScope}
								panes={presentation.panes}
								direction={presentation.direction}
								scopedItems={scopedItems}
								workspace={workspace}
								onAddItemsToAiContext={addItemsToAiContext}
								onCreateItem={createWorkspaceItem}
								onOpenItem={openItem}
							/>
						) : (
							<WorkspaceStandardTabPanes
								activeTabId={activeTab.id}
								itemsById={itemsById}
								scopedItems={scopedItems}
								tabs={session.tabs}
								workspace={workspace}
								onAddItemsToAiContext={addItemsToAiContext}
								onCreateItem={createWorkspaceItem}
								onOpenItem={openItem}
							/>
						)
					}
					chatPanel={
						chatPanelCollapsed || presentationHasChat ? undefined : (
							<AiChatPanel context={aiContextScope} />
						)
					}
				/>
			</WorkspaceItemToolbarProvider>
		);

	const workspaceInteractionContent = (
		<WorkspaceFileUploadProvider workspaceId={workspace.id}>
			<WorkspaceDragProvider
				items={scopedItems}
				selectedItemIds={new Set(selectedItemIds)}
				workspaceId={workspace.id}
				onAddItemsToAiContext={addItemIdsToAiContext}
				onMoveItems={moveWorkspaceItemsMutation.mutate}
				onWorkspaceDragCommand={dispatchWorkspaceDragCommand}
			>
				{presentationContent}
			</WorkspaceDragProvider>
		</WorkspaceFileUploadProvider>
	);

	return (
		<WorkspaceMutationAccessProvider membershipRole={workspace.membershipRole}>
			{hasHeavyViewerRuntimeItems ? (
				<WorkspacePdfEngineProvider>
					{workspaceInteractionContent}
				</WorkspacePdfEngineProvider>
			) : (
				workspaceInteractionContent
			)}
		</WorkspaceMutationAccessProvider>
	);
}
