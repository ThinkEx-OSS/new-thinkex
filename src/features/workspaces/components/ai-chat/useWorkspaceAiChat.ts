import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";

import {
	aiThreadAgentName,
	userAIAgentName,
	userAIBasePath,
} from "#/features/workspaces/agent-routes";
import type {
	AiChatMessage,
	AiChatModelId,
	AiChatSendMessage,
	AiChatSendMessageOptions,
	AiChatStatus,
} from "#/features/workspaces/components/ai-chat/types";

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
		getInitialMessages: null,
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
	const isBusy = isRecovering || isStreaming || isServerStreaming;
	const showThinking = status === "submitted" && !isToolContinuation;
	const canSend = status === "ready" && !isBusy;
	const canStop = status === "submitted" || isBusy;
	const inputStatus: AiChatStatus =
		isRecovering || showThinking ? "submitted" : isBusy ? "streaming" : status;
	const messageStatus: AiChatStatus = isBusy ? "streaming" : status;

	const sendMessage = (
		message: AiChatSendMessage,
		options?: AiChatSendMessageOptions,
	) => {
		if (message.parts.length === 0 || !canSend) {
			return false;
		}

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
		isRecovering,
		inputStatus,
		messageStatus,
		messages,
		regenerate,
		sendMessage,
		showThinking,
		stop,
	};
}

function getClientTimeZone() {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
}
