import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useCallback } from "react";

import type {
	AiChatMessage,
	AiChatModelId,
	AiChatSendMessage,
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
		agent: "UserAIStore",
		basePath: "user-ai",
		sub: [{ agent: "AIThread", name: threadId }],
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
		isStreaming,
		messages,
		regenerate: regenerateAgentMessage,
		sendMessage: sendAgentMessage,
		status,
		stop,
	} = chat;

	const sendMessage = useCallback(
		(message: AiChatSendMessage) => {
			if (
				message.parts.length === 0 ||
				status === "submitted" ||
				status === "streaming"
			) {
				return false;
			}

			clearError();
			void sendAgentMessage(message);
			return true;
		},
		[clearError, sendAgentMessage, status],
	);

	const addToolApprovalResponse = useCallback(
		(response: AiChatToolApprovalResponse) => {
			void addAgentToolApprovalResponse(response);
		},
		[addAgentToolApprovalResponse],
	);

	const regenerate = useCallback(() => {
		if (isStreaming) {
			return;
		}

		clearError();
		void regenerateAgentMessage();
	}, [clearError, isStreaming, regenerateAgentMessage]);

	return {
		addToolApprovalResponse,
		clearError,
		error,
		isStreaming,
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
