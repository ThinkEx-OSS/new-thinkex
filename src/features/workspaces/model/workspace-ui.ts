import {
	DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
	resolveWorkspaceAiChatModelId,
} from "#/features/workspaces/ai/models";
import type {
	WorkspaceAiChatSurfaceMode,
	WorkspacePane,
	WorkspacePresentation,
	WorkspaceUiSession,
} from "#/features/workspaces/state/workspace-ui-store";

type RestorableWorkspacePresentation = Exclude<
	WorkspacePresentation,
	{ mode: "maximized" }
>;

export const standardPresentation: RestorableWorkspacePresentation = {
	mode: "standard",
};

export const defaultWorkspaceUiSession: WorkspaceUiSession = {
	aiContextItemIds: [],
	aiChatModelId: DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
	chatSurfaceMode: "docked",
	presentation: standardPresentation,
};

export function getWorkspaceUiSession(session: WorkspaceUiSession | undefined) {
	if (!session) {
		return defaultWorkspaceUiSession;
	}

	const aiChatModelId = resolveWorkspaceAiChatModelId(session.aiChatModelId);
	const aiContextItemIds = Array.isArray(session.aiContextItemIds)
		? session.aiContextItemIds
		: defaultWorkspaceUiSession.aiContextItemIds;
	const chatSurfaceMode = resolveWorkspaceAiChatSurfaceMode(
		session.chatSurfaceMode,
	);
	const presentation =
		session.presentation ?? defaultWorkspaceUiSession.presentation;

	if (
		aiChatModelId === session.aiChatModelId &&
		aiContextItemIds === session.aiContextItemIds &&
		chatSurfaceMode === session.chatSurfaceMode &&
		presentation === session.presentation
	) {
		return session;
	}

	return {
		...defaultWorkspaceUiSession,
		...session,
		aiChatModelId,
		aiContextItemIds,
		chatSurfaceMode,
		presentation,
	};
}

export function normalizeWorkspaceUiSession(
	session: WorkspaceUiSession | undefined,
	validItemIds?: ReadonlySet<string>,
): WorkspaceUiSession {
	const normalizedSession = getWorkspaceUiSession(session);
	const presentation = normalizePresentation(
		normalizedSession.presentation,
		validItemIds,
	);
	const aiContextItemIds = normalizeAiContextItemIds(
		normalizedSession.aiContextItemIds,
		validItemIds,
	);

	return presentation === normalizedSession.presentation &&
		aiContextItemIds === normalizedSession.aiContextItemIds
		? normalizedSession
		: {
				...normalizedSession,
				aiContextItemIds,
				presentation,
			};
}

export function getUpdatedWorkspaceUiSession(
	currentSession: WorkspaceUiSession | undefined,
	updateSession: (session: WorkspaceUiSession) => Partial<WorkspaceUiSession>,
) {
	const session = normalizeWorkspaceUiSession(currentSession);
	const nextSession = {
		...session,
		...updateSession(session),
	};

	return isSameWorkspaceUiSession(session, nextSession) ? session : nextSession;
}

export function closeChatPanelSession() {
	return {
		chatSurfaceMode: "hidden" as const,
	};
}

export function openChatPanelSession(session: WorkspaceUiSession) {
	return {
		chatSurfaceMode: getVisibleWorkspaceAiChatSurfaceMode(session),
	};
}

export function dockChatPanelSession() {
	return {
		chatSurfaceMode: "docked" as const,
	};
}

export function addWorkspaceAiContextItemsSession(
	session: WorkspaceUiSession,
	itemIds: string[],
) {
	const nextIds = normalizeAiContextItemIds([
		...session.aiContextItemIds,
		...itemIds,
	]);

	return {
		aiContextItemIds:
			nextIds === session.aiContextItemIds ? session.aiContextItemIds : nextIds,
		chatSurfaceMode: getVisibleWorkspaceAiChatSurfaceMode(session),
	};
}

export function removeWorkspaceAiContextItemSession(
	session: WorkspaceUiSession,
	itemId: string,
) {
	if (!session.aiContextItemIds.includes(itemId)) {
		return {};
	}

	return {
		aiContextItemIds: session.aiContextItemIds.filter((id) => id !== itemId),
	};
}

export function setActiveAiChatThreadSession(threadId: string | undefined) {
	return {
		activeAiChatThreadId: threadId,
	};
}

export function setAiChatModelSession(modelId: unknown) {
	return {
		aiChatModelId: resolveWorkspaceAiChatModelId(modelId),
	};
}

export function toggleChatPanelSession(session: WorkspaceUiSession) {
	return {
		chatSurfaceMode:
			session.chatSurfaceMode === "hidden"
				? ("docked" as const)
				: ("hidden" as const),
	};
}

export function maximizeChatSession() {
	return {
		chatSurfaceMode: "fullscreen" as const,
	};
}

export function maximizeItemSession(
	session: WorkspaceUiSession,
	itemId: string,
) {
	return {
		presentation: {
			mode: "maximized" as const,
			pane: { id: `item:${itemId}`, kind: "item" as const, itemId },
			restorePresentation: getRestorablePresentation(session.presentation),
		},
	};
}

export function restoreWorkspacePresentationSession(
	session: WorkspaceUiSession,
) {
	return {
		presentation:
			session.presentation.mode === "maximized"
				? session.presentation.restorePresentation
				: standardPresentation,
	};
}

export function splitWorkspacePresentationSession(input: {
	direction: "horizontal" | "vertical";
	panes: [WorkspacePane, WorkspacePane];
	activePaneId: string;
}) {
	return {
		presentation: {
			mode: "split" as const,
			direction: input.direction,
			panes: input.panes,
			activePaneId: input.activePaneId,
		},
	};
}

function getRestorablePresentation(presentation: WorkspacePresentation) {
	if (presentation.mode === "maximized") {
		return presentation.restorePresentation;
	}

	return presentation;
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

function resolveWorkspaceAiChatSurfaceMode(
	mode: unknown,
): WorkspaceAiChatSurfaceMode {
	switch (mode) {
		case "hidden":
		case "docked":
		case "fullscreen":
			return mode;
		default:
			return defaultWorkspaceUiSession.chatSurfaceMode;
	}
}

function getVisibleWorkspaceAiChatSurfaceMode(session: WorkspaceUiSession) {
	return session.chatSurfaceMode === "hidden"
		? ("docked" as const)
		: session.chatSurfaceMode;
}

function normalizeAiContextItemIds(
	itemIds: string[] | undefined,
	validItemIds?: ReadonlySet<string>,
) {
	if (!itemIds?.length) {
		return defaultWorkspaceUiSession.aiContextItemIds;
	}

	const seen = new Set<string>();
	const normalizedIds: string[] = [];

	for (const itemId of itemIds) {
		if (
			!itemId ||
			seen.has(itemId) ||
			(validItemIds && !validItemIds.has(itemId))
		) {
			continue;
		}

		seen.add(itemId);
		normalizedIds.push(itemId);
	}

	if (
		normalizedIds.length === itemIds.length &&
		normalizedIds.every((id, index) => id === itemIds[index])
	) {
		return itemIds;
	}

	return normalizedIds;
}

function isSameWorkspaceUiSession(
	session: WorkspaceUiSession,
	nextSession: WorkspaceUiSession,
) {
	return (
		session.activeAiChatThreadId === nextSession.activeAiChatThreadId &&
		session.aiChatModelId === nextSession.aiChatModelId &&
		isSameStringArray(session.aiContextItemIds, nextSession.aiContextItemIds) &&
		session.chatSurfaceMode === nextSession.chatSurfaceMode &&
		session.presentation === nextSession.presentation
	);
}

function isSameStringArray(left: readonly string[], right: readonly string[]) {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}
