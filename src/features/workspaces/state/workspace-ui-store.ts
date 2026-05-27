import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

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
	if (!session) {
		return defaultWorkspaceUiSession;
	}

	const presentation = normalizePresentation(
		session.presentation,
		validItemIds,
	);

	return presentation === session.presentation
		? session
		: { ...session, presentation };
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
	updateSession: (session: WorkspaceUiSession) => Partial<WorkspaceUiSession>,
) {
	const currentSession = state.sessionsByWorkspaceId[workspaceId];
	const session = normalizeWorkspaceUiSession(currentSession);
	const nextSession = {
		...session,
		...updateSession(session),
	};

	if (
		session.activeAiChatThreadId === nextSession.activeAiChatThreadId &&
		session.chatPanelCollapsed === nextSession.chatPanelCollapsed &&
		session.presentation === nextSession.presentation
	) {
		return state;
	}

	return {
		sessionsByWorkspaceId: {
			...state.sessionsByWorkspaceId,
			[workspaceId]: nextSession,
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
						set((state) => ({
							sessionsByWorkspaceId: {
								...state.sessionsByWorkspaceId,
								[workspaceId]: nextSession,
							},
						}));
					}

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
						updateWorkspaceUiSession(state, workspaceId, () => ({
							chatPanelCollapsed: false,
						})),
					),
				setActiveAiChatThread: (workspaceId, threadId) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, () => ({
							activeAiChatThreadId: threadId,
							chatPanelCollapsed: false,
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
							presentation:
								session.presentation.mode === "maximized"
									? session.presentation.restorePresentation
									: standardPresentation,
						})),
					),
				setSplitPresentation: (
					workspaceId,
					{ direction, panes, activePaneId },
				) =>
					set((state) =>
						updateWorkspaceUiSession(state, workspaceId, () => ({
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
		zustandDevtoolsOptions("WorkspaceUiStore"),
	),
);
