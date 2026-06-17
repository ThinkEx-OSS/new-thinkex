import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";

import {
	aiThreadAgentName,
	userAIAgentName,
	userAIBasePath,
} from "#/features/workspaces/agent-routes";
import { deriveAiChatPresentation } from "#/features/workspaces/components/ai-chat/ai-chat-display-state";
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
	const presentation = deriveAiChatPresentation(messages, status, {
		isRecovering,
		isServerStreaming,
		isStreaming,
		isToolContinuation,
	});
	const { lifecycle } = presentation;
	const showThinking = presentation.showEphemeralAwaitingFirstToken;
	const canSend = status === "ready" && !lifecycle.isBusy;
	const canStop = status === "submitted" || lifecycle.isBusy;
	const inputStatus: AiChatStatus =
		isRecovering || showThinking
			? "submitted"
			: lifecycle.isBusy
				? "streaming"
				: status;
	const messageStatus: AiChatStatus = lifecycle.isBusy ? "streaming" : status;

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
		inputStatus,
		isRecovering,
		messageStatus,
		messages,
		presentation,
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
