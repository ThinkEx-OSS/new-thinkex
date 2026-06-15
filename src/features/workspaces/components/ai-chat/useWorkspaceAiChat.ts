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
	AiChatToolApprovalResponse,
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
		addToolApprovalResponse: addAgentToolApprovalResponse,
		clearError,
		error,
		isRecovering,
		isStreaming,
		messages,
		regenerate: regenerateAgentMessage,
		sendMessage: sendAgentMessage,
		status,
		stop,
	} = chat;

	const sendMessage = (
		message: AiChatSendMessage,
		options?: AiChatSendMessageOptions,
	) => {
		if (
			message.parts.length === 0 ||
			status === "submitted" ||
			status === "streaming"
		) {
			return false;
		}

		clearError();
		void sendAgentMessage(message, options);
		return true;
	};
	const addToolApprovalResponse = (response: AiChatToolApprovalResponse) => {
		void addAgentToolApprovalResponse(response);
	};
	const regenerate = () => {
		if (isStreaming || isRecovering) {
			return;
		}

		clearError();
		void regenerateAgentMessage();
	};

	return {
		addToolApprovalResponse,
		clearError,
		error,
		isRecovering,
		isStreaming,
		isBusy: isStreaming || isRecovering,
		messages,
		modelId,
		regenerate,
		sendMessage,
		status,
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
