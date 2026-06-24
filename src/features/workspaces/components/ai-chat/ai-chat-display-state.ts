import { isToolUIPart } from "ai";

import type {
	AiChatMessage,
	AiChatMessagePart,
	AiChatStatus,
} from "#/features/workspaces/components/ai-chat/types";

export type AssistantPendingKind = "thinking" | "recovering";

export type AssistantRowDisplay =
	| { kind: "content"; parts: AiChatMessagePart[] }
	| { kind: "empty-terminal"; canRegenerate: boolean }
	| { kind: "hidden" };

export interface AiChatPresentation {
	isBusy: boolean;
	isRecovering: boolean;
	isToolContinuation: boolean;
	lastAssistantMessageId: string | undefined;
	status: AiChatStatus;
	tailPending: AssistantPendingKind | null;
}

export function isAiChatStreamActive(status: AiChatStatus) {
	return status === "submitted" || status === "streaming";
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
	const lastAssistantMessageId = lastMessage?.role === "assistant" ? lastMessage.id : undefined;
	const isBusy = isRecovering || isStreaming || isServerStreaming;
	const awaitingFirstToken = status === "submitted" && !isToolContinuation;
	const hasAssistantTail = lastMessage?.role === "assistant";
	const assistantTailIsEmpty =
		lastMessage?.role === "assistant" && getDisplayableParts(lastMessage).length === 0;
	const tailPending = isRecovering
		? hasAssistantTail && !assistantTailIsEmpty
			? null
			: "recovering"
		: !isToolContinuation &&
			  (awaitingFirstToken || (isBusy && (!hasAssistantTail || assistantTailIsEmpty)))
			? "thinking"
			: null;

	return {
		isBusy,
		isRecovering,
		isToolContinuation,
		lastAssistantMessageId,
		status,
		tailPending,
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
	const isLastAssistant = message.id === presentation.lastAssistantMessageId;

	if (presentation.status === "error" && isLastAssistant && displayableParts.length === 0) {
		return { kind: "hidden" };
	}

	if (displayableParts.length > 0) {
		return { kind: "content", parts: displayableParts };
	}

	if (isLastAssistant && presentation.status === "ready" && !presentation.isBusy) {
		return {
			kind: "empty-terminal",
			canRegenerate: true,
		};
	}

	if (!presentation.isBusy) {
		return {
			kind: "empty-terminal",
			canRegenerate: false,
		};
	}

	return { kind: "hidden" };
}

export function getDisplayableParts(message: AiChatMessage): AiChatMessagePart[] {
	return message.parts.filter(isDisplayableMessagePart);
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
		part.type === "source-document" ||
		part.type.startsWith("data-")
	) {
		return true;
	}

	return false;
}
