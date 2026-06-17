import { isToolUIPart } from "ai";

import type {
	AiChatMessage,
	AiChatMessagePart,
	AiChatStatus,
} from "#/features/workspaces/components/ai-chat/types";

export type AssistantPendingKind = "thinking" | "recovering";

export type AssistantRowDisplay =
	| { kind: "content"; parts: AiChatMessagePart[] }
	| { kind: "pending"; pending: AssistantPendingKind }
	| { kind: "empty-terminal"; canRegenerate: boolean }
	| { kind: "hidden" };

export interface AiChatLifecycle {
	isBusy: boolean;
	isRecovering: boolean;
	isToolContinuation: boolean;
	status: AiChatStatus;
}

export interface AiChatPresentation {
	activeAssistantMessageId: string | undefined;
	lifecycle: AiChatLifecycle;
	regenerableAssistantMessageId: string | undefined;
	requestErrorAssistantMessageId: string | undefined;
	showEphemeralAwaitingFirstToken: boolean;
	showEphemeralRecovering: boolean;
	streamingAssistantMessageId: string | undefined;
}

export function deriveAiChatPresentation(
	messages: AiChatMessage[],
	status: AiChatStatus,
	{
		isRecovering,
		isServerStreaming,
		isStreaming,
		isToolContinuation,
	}: {
		isRecovering: boolean;
		isServerStreaming: boolean;
		isStreaming: boolean;
		isToolContinuation: boolean;
	},
): AiChatPresentation {
	const lastMessage = messages.at(-1);
	const lastAssistantMessageId =
		lastMessage?.role === "assistant" ? lastMessage.id : undefined;
	const isBusy = isRecovering || isStreaming || isServerStreaming;
	const showAwaitingFirstToken = status === "submitted" && !isToolContinuation;
	const lifecycle: AiChatLifecycle = {
		isBusy,
		isRecovering,
		isToolContinuation,
		status,
	};
	const activeAssistantMessageId = getActiveAssistantMessageId(
		messages,
		lifecycle,
		showAwaitingFirstToken,
	);
	const streamingAssistantMessageId =
		status === "streaming" && lastAssistantMessageId
			? lastAssistantMessageId
			: undefined;
	const requestErrorAssistantMessageId =
		status === "error" && lastAssistantMessageId
			? lastAssistantMessageId
			: undefined;
	const regenerableAssistantMessageId =
		status === "ready" && lastAssistantMessageId
			? lastAssistantMessageId
			: undefined;
	const showEphemeralAwaitingFirstToken =
		showAwaitingFirstToken && lastMessage?.role !== "assistant";
	const showEphemeralRecovering =
		isRecovering && lastMessage?.role !== "assistant";

	return {
		activeAssistantMessageId,
		lifecycle,
		regenerableAssistantMessageId,
		requestErrorAssistantMessageId,
		showEphemeralAwaitingFirstToken,
		showEphemeralRecovering,
		streamingAssistantMessageId,
	};
}

export function getAssistantRowDisplay(
	message: AiChatMessage,
	presentation: AiChatPresentation,
): AssistantRowDisplay | null {
	if (message.role !== "assistant") {
		return null;
	}

	const displayableParts = getDisplayableParts(message);
	const isLastAssistant = message.id === presentation.activeAssistantMessageId;
	const isRequestError =
		message.id === presentation.requestErrorAssistantMessageId;
	const isRegenerable =
		message.id === presentation.regenerableAssistantMessageId;

	if (isRequestError && displayableParts.length === 0) {
		return { kind: "hidden" };
	}

	if (displayableParts.length > 0) {
		return { kind: "content", parts: displayableParts };
	}

	if (isLastAssistant && shouldShowAssistantAsPending(message, presentation)) {
		return {
			kind: "pending",
			pending: presentation.lifecycle.isRecovering ? "recovering" : "thinking",
		};
	}

	if (
		isLastAssistant &&
		presentation.lifecycle.status === "ready" &&
		!presentation.lifecycle.isBusy
	) {
		return {
			kind: "empty-terminal",
			canRegenerate: Boolean(isRegenerable),
		};
	}

	if (!presentation.lifecycle.isBusy) {
		return {
			kind: "empty-terminal",
			canRegenerate: false,
		};
	}

	return { kind: "hidden" };
}

export function getDisplayableParts(
	message: AiChatMessage,
): AiChatMessagePart[] {
	return message.parts.filter(isDisplayableMessagePart);
}

export function hasDisplayableContent(message: AiChatMessage): boolean {
	return getDisplayableParts(message).length > 0;
}

export function isDisplayableMessagePart(part: AiChatMessagePart): boolean {
	if (part.type === "text") {
		return part.text.length > 0 || part.state === "streaming";
	}

	if (part.type === "reasoning" || part.type === "step-start") {
		return false;
	}

	if (isToolUIPart(part)) {
		return true;
	}

	if (
		part.type === "file" ||
		part.type === "source-url" ||
		part.type === "source-document"
	) {
		return true;
	}

	if (part.type.startsWith("data-")) {
		return true;
	}

	return false;
}

function getActiveAssistantMessageId(
	messages: AiChatMessage[],
	lifecycle: AiChatLifecycle,
	showAwaitingFirstToken: boolean,
) {
	const lastMessage = messages.at(-1);

	if (lastMessage?.role !== "assistant") {
		return undefined;
	}

	if (
		showAwaitingFirstToken ||
		lifecycle.isRecovering ||
		lifecycle.isBusy ||
		lifecycle.status === "ready" ||
		lifecycle.status === "error"
	) {
		return lastMessage.id;
	}

	return undefined;
}

function shouldShowAssistantAsPending(
	message: AiChatMessage,
	presentation: AiChatPresentation,
) {
	if (message.role !== "assistant" || hasDisplayableContent(message)) {
		return false;
	}

	const { lifecycle } = presentation;

	if (lifecycle.isRecovering) {
		return true;
	}

	if (lifecycle.status === "submitted" && !lifecycle.isToolContinuation) {
		return true;
	}

	if (
		lifecycle.isBusy &&
		message.id === presentation.streamingAssistantMessageId
	) {
		return true;
	}

	return false;
}
