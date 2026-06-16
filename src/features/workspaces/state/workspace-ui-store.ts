import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import {
	normalizeWorkspaceItemViewState,
	type WorkspaceItemViewState,
} from "#/features/workspaces/model/workspace-item-view-state";
import type { WorkspaceSelectedMention } from "#/features/workspaces/model/workspace-selected-mentions";
import {
	addWorkspaceAiContextItemsSession,
	addWorkspaceSelectedMentionSession,
	clearWorkspaceSelectedMentionsSession,
	closeChatPanelSession,
	defaultWorkspaceUiSession,
	getUpdatedWorkspaceUiSession,
	getWorkspaceUiSession,
	maximizeChatSession,
	maximizeItemSession,
	normalizeWorkspaceUiSession,
	openChatPanelSession,
	removeWorkspaceAiContextItemSession,
	removeWorkspaceSelectedMentionSession,
	restoreWorkspacePresentationSession,
	setActiveAiChatThreadSession,
	splitWorkspacePresentationSession,
	toggleChatPanelCollapsedSession,
} from "#/features/workspaces/model/workspace-ui";
import { zustandDevtoolsOptions } from "#/lib/zustand-devtools";

export type WorkspacePane =
	| { id: string; kind: "root" }
	| { id: string; kind: "item"; itemId: string }
	| { id: string; kind: "chat" };

export type WorkspacePresentation =
	| { mode: "standard" }
	| {
			mode: "split";
			direction: "horizontal" | "vertical";
			panes: [WorkspacePane, WorkspacePane];
			activePaneId: string;
	  }
	| {
			mode: "maximized";
			pane: WorkspacePane;
			restorePresentation: RestorableWorkspacePresentation;
	  };

type RestorableWorkspacePresentation = Exclude<
	WorkspacePresentation,
	{ mode: "maximized" }
>;

export type WorkspaceUiSession = {
	activeAiChatThreadId?: string;
	aiContextItemIds: string[];
	chatPanelCollapsed: boolean;
	presentation: WorkspacePresentation;
	selectedMentions: WorkspaceSelectedMention[];
};

type EnsureWorkspaceUiSessionInput = {
	workspaceId: string;
	validItemIds?: ReadonlySet<string>;
};

type WorkspaceUiState = {
	itemViewStatesByWorkspaceId: Record<
		string,
		Record<string, WorkspaceItemViewState | undefined> | undefined
	>;
	sessionsByWorkspaceId: Record<string, WorkspaceUiSession>;
	ensureWorkspaceSession: (
		input: EnsureWorkspaceUiSessionInput,
	) => WorkspaceUiSession;
	addAiContextItems: (workspaceId: string, itemIds: string[]) => void;
	addSelectedMention: (
		workspaceId: string,
		mention: WorkspaceSelectedMention,
	) => void;
	clearSelectedMentions: (workspaceId: string) => void;
	clearItemViewState: (workspaceId: string, itemId?: string) => void;
	closeChatPanel: (workspaceId: string) => void;
	openChatPanel: (workspaceId: string) => void;
	removeAiContextItem: (workspaceId: string, itemId: string) => void;
	removeSelectedMention: (workspaceId: string, mentionId: string) => void;
	setActiveAiChatThread: (
		workspaceId: string,
		threadId: string | undefined,
	) => void;
	setItemViewState: (
		workspaceId: string,
		viewState: WorkspaceItemViewState,
	) => void;
	toggleChatPanelCollapsed: (workspaceId: string) => void;
	maximizeChat: (workspaceId: string) => void;
	maximizeItem: (workspaceId: string, itemId: string) => void;
	restorePresentation: (workspaceId: string) => void;
	setSplitPresentation: (
		workspaceId: string,
		input: {
			direction: "horizontal" | "vertical";
			panes: [WorkspacePane, WorkspacePane];
			activePaneId: string;
		},
	) => void;
	getSession: (workspaceId: string) => WorkspaceUiSession | undefined;
};

export { defaultWorkspaceUiSession, getWorkspaceUiSession };

export const selectWorkspaceUiSession =
	(workspaceId: string) => (state: WorkspaceUiState) =>
		getWorkspaceUiSession(state.sessionsByWorkspaceId[workspaceId]);

export const selectWorkspacePresentation =
	(workspaceId: string) => (state: WorkspaceUiState) =>
		selectWorkspaceUiSession(workspaceId)(state).presentation;

export const selectWorkspaceActiveAiChatThreadId =
	(workspaceId: string) => (state: WorkspaceUiState) =>
		selectWorkspaceUiSession(workspaceId)(state).activeAiChatThreadId;

export const selectWorkspaceAiContextItemIds =
	(workspaceId: string) => (state: WorkspaceUiState) =>
		selectWorkspaceUiSession(workspaceId)(state).aiContextItemIds;

export const selectWorkspaceSelectedMentions =
	(workspaceId: string) => (state: WorkspaceUiState) =>
		selectWorkspaceUiSession(workspaceId)(state).selectedMentions;

export const selectWorkspaceItemViewStates =
	(workspaceId: string) => (state: WorkspaceUiState) =>
		state.itemViewStatesByWorkspaceId[workspaceId];

function updateWorkspaceUiSession(
	state: WorkspaceUiState,
	workspaceId: string,
	updateSession: (session: WorkspaceUiSession) => Partial<WorkspaceUiSession>,
) {
	const currentSession = state.sessionsByWorkspaceId[workspaceId];
	const currentNormalizedSession = getWorkspaceUiSession(currentSession);
	const nextSession = getUpdatedWorkspaceUiSession(
		currentSession,
		updateSession,
	);

	if (nextSession === currentNormalizedSession) {
		return state;
	}

	return withWorkspaceUiSession(state, workspaceId, nextSession);
}

function withWorkspaceUiSession(
	state: WorkspaceUiState,
	workspaceId: string,
	session: WorkspaceUiSession,
) {
	return {
		sessionsByWorkspaceId: {
			...state.sessionsByWorkspaceId,
			[workspaceId]: session,
		},
	};
}

export const useWorkspaceUiStore = create<WorkspaceUiState>()(
	devtools(
		persist(
			(set, get) => ({
				itemViewStatesByWorkspaceId: {},
				sessionsByWorkspaceId: {},
				ensureWorkspaceSession: ({ workspaceId, validItemIds }) => {
					const currentSession = get().sessionsByWorkspaceId[workspaceId];
					const nextSession = normalizeWorkspaceUiSession(
						currentSession,
						validItemIds,
					);

					if (nextSession !== currentSession) {
						set((state) =>
							withWorkspaceUiSession(state, workspaceId, nextSession),
						);
					}

					return nextSession;
				},
				addAiContextItems: (workspaceId, itemIds) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, (session) =>
							addWorkspaceAiContextItemsSession(session, itemIds),
						),
					),
				addSelectedMention: (workspaceId, mention) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, (session) =>
							addWorkspaceSelectedMentionSession(session, mention),
						),
					),
				clearSelectedMentions: (workspaceId) =>
					set((state) =>
						updateWorkspaceUiSession(
							state,
							workspaceId,
							clearWorkspaceSelectedMentionsSession,
						),
					),
				clearItemViewState: (workspaceId, itemId) =>
					set((state) => {
						const currentDetails =
							state.itemViewStatesByWorkspaceId[workspaceId];
						const currentViewState = itemId
							? currentDetails?.[itemId]
							: currentDetails;

						if (!currentViewState) {
							return state;
						}

						if (!itemId) {
							return {
								itemViewStatesByWorkspaceId: {
									...state.itemViewStatesByWorkspaceId,
									[workspaceId]: undefined,
								},
							};
						}

						return {
							itemViewStatesByWorkspaceId: {
								...state.itemViewStatesByWorkspaceId,
								[workspaceId]: {
									...currentDetails,
									[itemId]: undefined,
								},
							},
						};
					}),
				closeChatPanel: (workspaceId) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, closeChatPanelSession),
					),
				openChatPanel: (workspaceId) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, openChatPanelSession),
					),
				removeAiContextItem: (workspaceId, itemId) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, (session) =>
							removeWorkspaceAiContextItemSession(session, itemId),
						),
					),
				removeSelectedMention: (workspaceId, mentionId) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, (session) =>
							removeWorkspaceSelectedMentionSession(session, mentionId),
						),
					),
				setActiveAiChatThread: (workspaceId, threadId) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, () =>
							setActiveAiChatThreadSession(threadId),
						),
					),
				setItemViewState: (workspaceId, viewState) =>
					set((state) => ({
						itemViewStatesByWorkspaceId: {
							...state.itemViewStatesByWorkspaceId,
							[workspaceId]: {
								...state.itemViewStatesByWorkspaceId[workspaceId],
								[viewState.itemId]: normalizeWorkspaceItemViewState(viewState),
							},
						},
					})),
				toggleChatPanelCollapsed: (workspaceId) =>
					set((state) =>
						updateWorkspaceUiSession(
							state,
							workspaceId,
							toggleChatPanelCollapsedSession,
						),
					),
				maximizeChat: (workspaceId) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, maximizeChatSession),
					),
				maximizeItem: (workspaceId, itemId) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, (session) =>
							maximizeItemSession(session, itemId),
						),
					),
				restorePresentation: (workspaceId) =>
					set((state) =>
						updateWorkspaceUiSession(
							state,
							workspaceId,
							restoreWorkspacePresentationSession,
						),
					),
				setSplitPresentation: (
					workspaceId,
					{ direction, panes, activePaneId },
				) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, () =>
							splitWorkspacePresentationSession({
								direction,
								panes,
								activePaneId,
							}),
						),
					),
				getSession: (workspaceId) => get().sessionsByWorkspaceId[workspaceId],
			}),
			{
				name: "thinkex.workspace-ui.v2",
				skipHydration: true,
				partialize: (state) => ({
					sessionsByWorkspaceId: state.sessionsByWorkspaceId,
				}),
			},
		),
		zustandDevtoolsOptions("WorkspaceUiStore"),
	),
);
