import {
	normalizeWorkspaceSelectedMention,
	type WorkspaceSelectedMention,
} from "#/features/workspaces/model/workspace-selected-mentions";
import type {
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
	chatPanelCollapsed: false,
	presentation: standardPresentation,
	selectedMentions: [],
};

const chatPane: WorkspacePane = { id: "chat", kind: "chat" };

export function getWorkspaceUiSession(session: WorkspaceUiSession | undefined) {
	if (!session) {
		return defaultWorkspaceUiSession;
	}

	if (Array.isArray(session.selectedMentions)) {
		return session;
	}

	return {
		...defaultWorkspaceUiSession,
		...session,
		selectedMentions: defaultWorkspaceUiSession.selectedMentions,
	};
}

export function normalizeWorkspaceUiSession(
	session: WorkspaceUiSession | undefined,
	validItemIds?: ReadonlySet<string>,
): WorkspaceUiSession {
	if (!session) {
		return getWorkspaceUiSession(session);
	}

	const presentation = normalizePresentation(
		session.presentation,
		validItemIds,
	);
	const aiContextItemIds = normalizeAiContextItemIds(
		session.aiContextItemIds,
		validItemIds,
	);
	const selectedMentions = normalizeSelectedMentions(session.selectedMentions);

	return presentation === session.presentation &&
		aiContextItemIds === session.aiContextItemIds &&
		selectedMentions === session.selectedMentions
		? session
		: { ...session, aiContextItemIds, presentation, selectedMentions };
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

export function closeChatPanelSession(session: WorkspaceUiSession) {
	return {
		chatPanelCollapsed: true,
		presentation:
			session.presentation.mode === "maximized" &&
			session.presentation.pane.kind === "chat"
				? session.presentation.restorePresentation
				: session.presentation,
	};
}

export function openChatPanelSession() {
	return {
		chatPanelCollapsed: false,
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
		chatPanelCollapsed: false,
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

export function addWorkspaceSelectedMentionSession(
	session: WorkspaceUiSession,
	mention: WorkspaceSelectedMention,
) {
	const normalizedMention = normalizeWorkspaceSelectedMention(mention);

	if (!normalizedMention) {
		return {};
	}

	const selectedMentions = [
		...session.selectedMentions.filter(
			(item) => item.id !== normalizedMention.id,
		),
		normalizedMention,
	];

	return {
		chatPanelCollapsed: false,
		selectedMentions,
	};
}

export function removeWorkspaceSelectedMentionSession(
	session: WorkspaceUiSession,
	mentionId: string,
) {
	if (!session.selectedMentions.some((mention) => mention.id === mentionId)) {
		return {};
	}

	return {
		selectedMentions: session.selectedMentions.filter(
			(mention) => mention.id !== mentionId,
		),
	};
}

export function clearWorkspaceSelectedMentionsSession(
	session: WorkspaceUiSession,
) {
	if (session.selectedMentions.length === 0) {
		return {};
	}

	return {
		selectedMentions: defaultWorkspaceUiSession.selectedMentions,
	};
}

export function setActiveAiChatThreadSession(threadId: string | undefined) {
	return {
		activeAiChatThreadId: threadId,
		chatPanelCollapsed: false,
	};
}

export function toggleChatPanelCollapsedSession(session: WorkspaceUiSession) {
	return {
		chatPanelCollapsed: !session.chatPanelCollapsed,
		presentation:
			session.presentation.mode === "maximized" &&
			session.presentation.pane.kind === "chat"
				? session.presentation.restorePresentation
				: session.presentation,
	};
}

export function maximizeChatSession(session: WorkspaceUiSession) {
	return {
		chatPanelCollapsed: false,
		presentation: {
			mode: "maximized" as const,
			pane: chatPane,
			restorePresentation: getRestorablePresentation(session.presentation),
		},
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

function normalizeSelectedMentions(
	mentions: WorkspaceSelectedMention[] | undefined,
) {
	if (!mentions?.length) {
		return defaultWorkspaceUiSession.selectedMentions;
	}

	const seen = new Set<string>();
	const normalizedMentions: WorkspaceSelectedMention[] = [];

	for (const mention of mentions) {
		const normalizedMention = normalizeWorkspaceSelectedMention(mention);

		if (!normalizedMention || seen.has(normalizedMention.id)) {
			continue;
		}

		seen.add(normalizedMention.id);
		normalizedMentions.push(normalizedMention);
	}

	if (
		normalizedMentions.length === mentions.length &&
		normalizedMentions.every((mention, index) => mention === mentions[index])
	) {
		return mentions;
	}

	return normalizedMentions;
}

function isSameWorkspaceUiSession(
	session: WorkspaceUiSession,
	nextSession: WorkspaceUiSession,
) {
	return (
		session.activeAiChatThreadId === nextSession.activeAiChatThreadId &&
		isSameStringArray(session.aiContextItemIds, nextSession.aiContextItemIds) &&
		session.chatPanelCollapsed === nextSession.chatPanelCollapsed &&
		session.presentation === nextSession.presentation &&
		isSameSelectedMentionArray(
			session.selectedMentions,
			nextSession.selectedMentions,
		)
	);
}

function isSameStringArray(left: readonly string[], right: readonly string[]) {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function isSameSelectedMentionArray(
	left: readonly WorkspaceSelectedMention[],
	right: readonly WorkspaceSelectedMention[],
) {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}
