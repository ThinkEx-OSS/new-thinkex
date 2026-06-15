import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import {
	addWorkspaceAiContextItemsSession,
	closeChatPanelSession,
	defaultWorkspaceUiSession,
	getUpdatedWorkspaceUiSession,
	getWorkspaceUiSession,
	maximizeChatSession,
	maximizeItemSession,
	normalizeWorkspaceUiSession,
	openChatPanelSession,
	removeWorkspaceAiContextItemSession,
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
};

type EnsureWorkspaceUiSessionInput = {
	workspaceId: string;
	validItemIds?: ReadonlySet<string>;
};

type WorkspaceUiState = {
	sessionsByWorkspaceId: Record<string, WorkspaceUiSession>;
	ensureWorkspaceSession: (
		input: EnsureWorkspaceUiSessionInput,
	) => WorkspaceUiSession;
	addAiContextItems: (workspaceId: string, itemIds: string[]) => void;
	closeChatPanel: (workspaceId: string) => void;
	openChatPanel: (workspaceId: string) => void;
	removeAiContextItem: (workspaceId: string, itemId: string) => void;
	setActiveAiChatThread: (
		workspaceId: string,
		threadId: string | undefined,
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
				setActiveAiChatThread: (workspaceId, threadId) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, () =>
							setActiveAiChatThreadSession(threadId),
						),
					),
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
