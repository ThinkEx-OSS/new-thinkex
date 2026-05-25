import { create } from "zustand";
import { persist } from "zustand/middleware";

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
	closeChatPanel: (workspaceId: string) => void;
	openChatPanel: (workspaceId: string) => void;
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

const standardPresentation: RestorableWorkspacePresentation = {
	mode: "standard",
};
const defaultWorkspaceUiSession: WorkspaceUiSession = {
	chatPanelCollapsed: false,
	presentation: standardPresentation,
};
const chatPane: WorkspacePane = { id: "chat", kind: "chat" };

function getRestorablePresentation(presentation: WorkspacePresentation) {
	if (presentation.mode === "maximized") {
		return presentation.restorePresentation;
	}

	return presentation;
}

function normalizeWorkspaceUiSession(
	session: WorkspaceUiSession | undefined,
	validItemIds?: ReadonlySet<string>,
): WorkspaceUiSession {
	const nextSession = session ?? defaultWorkspaceUiSession;
	const presentation = normalizePresentation(
		nextSession.presentation,
		validItemIds,
	);

	return {
		chatPanelCollapsed: nextSession.chatPanelCollapsed,
		presentation,
	};
}

function normalizePresentation(
	presentation: WorkspacePresentation,
	validItemIds?: ReadonlySet<string>,
): WorkspacePresentation {
	if (!validItemIds) {
		return presentation;
	}

	if (presentation.mode === "standard") {
		return presentation;
	}

	if (presentation.mode === "maximized") {
		if (!isValidPane(presentation.pane, validItemIds)) {
			return standardPresentation;
		}

		const normalizedRestorePresentation = normalizePresentation(
			presentation.restorePresentation,
			validItemIds,
		);

		if (normalizedRestorePresentation.mode === "maximized") {
			return {
				mode: "maximized",
				pane: presentation.pane,
				restorePresentation: standardPresentation,
			};
		}

		return {
			mode: "maximized",
			pane: presentation.pane,
			restorePresentation: normalizedRestorePresentation,
		};
	}

	if (!presentation.panes.every((pane) => isValidPane(pane, validItemIds))) {
		return standardPresentation;
	}

	return presentation;
}

function isValidPane(pane: WorkspacePane, validItemIds: ReadonlySet<string>) {
	return pane.kind !== "item" || validItemIds.has(pane.itemId);
}

function updateWorkspaceUiSession(
	state: WorkspaceUiState,
	workspaceId: string,
	updateSession: (session: WorkspaceUiSession) => WorkspaceUiSession,
) {
	const session = normalizeWorkspaceUiSession(
		state.sessionsByWorkspaceId[workspaceId],
	);

	return {
		sessionsByWorkspaceId: {
			...state.sessionsByWorkspaceId,
			[workspaceId]: updateSession(session),
		},
	};
}

export const useWorkspaceUiStore = create<WorkspaceUiState>()(
	persist(
		(set, get) => ({
			sessionsByWorkspaceId: {},
			ensureWorkspaceSession: ({ workspaceId, validItemIds }) => {
				const nextSession = normalizeWorkspaceUiSession(
					get().sessionsByWorkspaceId[workspaceId],
					validItemIds,
				);

				set((state) => ({
					sessionsByWorkspaceId: {
						...state.sessionsByWorkspaceId,
						[workspaceId]: nextSession,
					},
				}));

				return nextSession;
			},
			closeChatPanel: (workspaceId) =>
				set((state) =>
					updateWorkspaceUiSession(state, workspaceId, (session) => ({
						chatPanelCollapsed: true,
						presentation:
							session.presentation.mode === "maximized" &&
							session.presentation.pane.kind === "chat"
								? session.presentation.restorePresentation
								: session.presentation,
					})),
				),
			openChatPanel: (workspaceId) =>
				set((state) =>
					updateWorkspaceUiSession(state, workspaceId, (session) => ({
						chatPanelCollapsed: false,
						presentation: session.presentation,
					})),
				),
			toggleChatPanelCollapsed: (workspaceId) =>
				set((state) =>
					updateWorkspaceUiSession(state, workspaceId, (session) => ({
						chatPanelCollapsed: !session.chatPanelCollapsed,
						presentation:
							session.presentation.mode === "maximized" &&
							session.presentation.pane.kind === "chat"
								? session.presentation.restorePresentation
								: session.presentation,
					})),
				),
			maximizeChat: (workspaceId) =>
				set((state) =>
					updateWorkspaceUiSession(state, workspaceId, (session) => ({
						chatPanelCollapsed: false,
						presentation: {
							mode: "maximized",
							pane: chatPane,
							restorePresentation: getRestorablePresentation(
								session.presentation,
							),
						},
					})),
				),
			maximizeItem: (workspaceId, itemId) =>
				set((state) =>
					updateWorkspaceUiSession(state, workspaceId, (session) => ({
						chatPanelCollapsed: session.chatPanelCollapsed,
						presentation: {
							mode: "maximized",
							pane: { id: `item:${itemId}`, kind: "item", itemId },
							restorePresentation: getRestorablePresentation(
								session.presentation,
							),
						},
					})),
				),
			restorePresentation: (workspaceId) =>
				set((state) =>
					updateWorkspaceUiSession(state, workspaceId, (session) => ({
						chatPanelCollapsed: session.chatPanelCollapsed,
						presentation:
							session.presentation.mode === "maximized"
								? session.presentation.restorePresentation
								: standardPresentation,
					})),
				),
			setSplitPresentation: (workspaceId, { direction, panes, activePaneId }) =>
				set((state) =>
					updateWorkspaceUiSession(state, workspaceId, (session) => ({
						chatPanelCollapsed: session.chatPanelCollapsed,
						presentation: {
							mode: "split",
							direction,
							panes,
							activePaneId,
						},
					})),
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
);
