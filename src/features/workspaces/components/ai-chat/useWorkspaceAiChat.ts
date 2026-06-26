import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useState } from "react";

import {
	aiThreadAgentName,
	userAIAgentName,
	userAIBasePath,
} from "#/features/workspaces/agent-routes";
import { deriveAiChatPresentation } from "#/features/workspaces/components/ai-chat/ai-chat-display-state";
import type {
	AiChatMessage,
	AiChatMessagePart,
	AiChatModelId,
	AiChatSendMessage,
	AiChatSendMessageOptions,
	AiChatStatus,
} from "#/features/workspaces/components/ai-chat/types";

interface OptimisticUserMessage {
	message: AiChatMessage;
	previousMessageIds: Set<string>;
}

interface UseWorkspaceAiChatOptions {
	modelId: AiChatModelId;
	threadId: string;
}

export function useWorkspaceAiChat({
	modelId,
	threadId,
}: UseWorkspaceAiChatOptions) {
	const agent = useAgent({
		agent: userAIAgentName,
		basePath: userAIBasePath,
		sub: [{ agent: aiThreadAgentName, name: threadId }],
	});
	const chat = useAgentChat<unknown, AiChatMessage>({
		agent,
		body: () => ({
			modelId,
			timeZone: getClientTimeZone(),
		}),
	});
	const {
		clearError,
		error,
		isRecovering,
		isServerStreaming,
		isStreaming,
		isToolContinuation,
		messages,
		regenerate: regenerateAgentMessage,
		sendMessage: sendAgentMessage,
		status,
		stop,
	} = chat;
	const [optimisticUserMessage, setOptimisticUserMessage] =
		useState<OptimisticUserMessage | null>(null);
	const visibleMessages = getVisibleMessages(
		messages,
		status,
		optimisticUserMessage,
	);
	const presentation = deriveAiChatPresentation(visibleMessages, status, {
		isRecovering,
		isServerStreaming,
		isStreaming,
		isToolContinuation,
	});
	const canStop = status === "submitted" || presentation.isBusy;
	const inputStatus: AiChatStatus =
		presentation.tailPending || presentation.isRecovering
			? "submitted"
			: presentation.isBusy
				? "streaming"
				: status === "error"
					? "ready"
					: status;
	const canSend = inputStatus === "ready" && !presentation.isBusy;

	const sendMessage = (
		message: AiChatSendMessage,
		options?: AiChatSendMessageOptions,
	) => {
		if (message.parts.length === 0 || !canSend) {
			return false;
		}

		setOptimisticUserMessage({
			message: createOptimisticUserMessage(message),
			previousMessageIds: new Set(
				messages.map((currentMessage) => currentMessage.id),
			),
		});
		clearError();
		void sendAgentMessage(message, options);
		return true;
	};
	const regenerate = () => {
		if (canStop) {
			return;
		}

		clearError();
		void regenerateAgentMessage();
	};

	return {
		error,
		inputStatus,
		messages: visibleMessages,
		presentation,
		regenerate,
		sendMessage,
		stop,
	};
}

function getVisibleMessages(
	messages: AiChatMessage[],
	status: AiChatStatus,
	optimisticUserMessage: OptimisticUserMessage | null,
) {
	if (
		optimisticUserMessage === null ||
		!isSubmittedOrStreaming(status) ||
		hasAcceptedUserMessage(messages, optimisticUserMessage)
	) {
		return messages;
	}

	return [...messages, optimisticUserMessage.message];
}

function createOptimisticUserMessage(
	message: AiChatSendMessage,
): AiChatMessage {
	return {
		id: createOptimisticUserMessageId(),
		role: message.role,
		parts: message.parts,
	};
}

function createOptimisticUserMessageId() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return `optimistic-user:${crypto.randomUUID()}`;
	}

	return `optimistic-user:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function hasAcceptedUserMessage(
	messages: AiChatMessage[],
	optimisticUserMessage: OptimisticUserMessage,
) {
	return messages.some(
		(message) =>
			message.role === "user" &&
			!optimisticUserMessage.previousMessageIds.has(message.id) &&
			isSameMessageContent(message.parts, optimisticUserMessage.message.parts),
	);
}

function isSameMessageContent(
	partsA: AiChatMessagePart[],
	partsB: AiChatMessagePart[],
): boolean {
	if (partsA.length !== partsB.length) return false;
	return partsA.every((partA, i) => {
		const partB = partsB[i];
		if (partA.type !== partB.type) return false;
		if (partA.type === "text" && partB.type === "text") {
			return partA.text === partB.text;
		}
		if (partA.type === "file" && partB.type === "file") {
			return partA.url === partB.url;
		}
		return true;
	});
}

function isSubmittedOrStreaming(status: AiChatStatus) {
	return status === "submitted" || status === "streaming";
}

function getClientTimeZone() {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
}
