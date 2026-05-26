import type { ChatStatus, DynamicToolUIPart, ToolUIPart, UIMessage } from "ai";

import type { WorkspaceAiChatModelId } from "#/features/workspaces/ai/models";

export type AiChatMessage = UIMessage;
export type AiChatMessagePart = UIMessage["parts"][number];
export type AiChatToolPart = ToolUIPart | DynamicToolUIPart;
export type AiChatModelId = WorkspaceAiChatModelId;

export interface AiChatSendMessage {
	role: "user";
	parts: AiChatMessagePart[];
}

export interface AiChatToolApprovalResponse {
	id: string;
	approved: boolean;
}

export type AiChatStatus = ChatStatus;
