import { RotateCcw } from "lucide-react";
import type { ComponentProps } from "react";

import {
	Conversation,
	ConversationContent,
} from "#/components/ai-elements/conversation";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import type { AIInspectorSnapshot } from "#/features/workspaces/ai/ai-inspector";
import AiChatMessageList from "#/features/workspaces/components/ai-chat/AiChatMessageList";
import AiChatPromptInput from "#/features/workspaces/components/ai-chat/AiChatPromptInput";
import type {
	AiChatMessage,
	AiChatModelId,
	AiChatSendMessage,
	AiChatStatus,
} from "#/features/workspaces/components/ai-chat/types";
import { useWorkspaceAiChat } from "#/features/workspaces/components/ai-chat/useWorkspaceAiChat";
import type { WorkspaceAiContextScope } from "#/features/workspaces/model/workspace-ai-context";
import { buildWorkspaceAiContextSnapshot } from "#/features/workspaces/model/workspace-ai-context";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";

type AiChatPromptMessage = Parameters<
	NonNullable<ComponentProps<typeof AiChatPromptInput>["onSubmit"]>
>[0];

export default function AiChatThreadView({
	context,
	getInspectorSnapshot,
	hasPersistedMessages,
	modelId,
	onModelChange,
	onThreadActivated,
	threadId,
}: {
	context: WorkspaceAiContextScope;
	getInspectorSnapshot?: (threadId: string) => Promise<AIInspectorSnapshot>;
	hasPersistedMessages: boolean;
	modelId: AiChatModelId;
	onModelChange: (modelId: AiChatModelId) => void;
	onThreadActivated?: () => void;
	threadId: string;
}) {
	const chat = useWorkspaceAiChat({ modelId, threadId });
	const {
		addToolApprovalResponse,
		error,
		isRecovering,
		messages,
		regenerate,
		sendMessage: sendChatMessage,
		status,
		stop,
	} = chat;
	const clearSelectedMentions = useWorkspaceUiStore(
		(state) => state.clearSelectedMentions,
	);
	const sendMessage = (message: AiChatPromptMessage) => {
		const chatMessage = getChatMessageFromPrompt(message);

		if (!chatMessage) {
			return false;
		}

		const didSend = sendChatMessage(chatMessage, {
			body: {
				workspaceAiContext: buildWorkspaceAiContextSnapshot(context),
			},
		});

		if (didSend) {
			clearSelectedMentions(context.workspaceId);
			onThreadActivated?.();
		}

		return didSend;
	};

	return (
		<AiChatPanelBody
			context={context}
			isLoadingHistory={hasPersistedMessages && messages.length === 0}
			error={error}
			getInspectorSnapshot={getInspectorSnapshot}
			isRecovering={isRecovering}
			messages={messages}
			onModelChange={onModelChange}
			onRegenerateLastResponse={regenerate}
			onRetryLastResponse={regenerate}
			onStop={stop}
			onSubmit={sendMessage}
			onToolApprovalResponse={addToolApprovalResponse}
			modelId={modelId}
			status={status}
			threadId={threadId}
		/>
	);
}

function AiChatPanelBody({
	context,
	error,
	getInspectorSnapshot,
	isLoadingHistory,
	isRecovering,
	messages,
	modelId,
	onModelChange,
	onRegenerateLastResponse,
	onRetryLastResponse,
	onStop,
	onSubmit,
	onToolApprovalResponse,
	status,
	threadId,
}: {
	context: WorkspaceAiContextScope;
	error?: Error;
	getInspectorSnapshot?: (threadId: string) => Promise<AIInspectorSnapshot>;
	isLoadingHistory?: boolean;
	isRecovering?: boolean;
	messages: AiChatMessage[];
	modelId: AiChatModelId;
	onModelChange: (modelId: AiChatModelId) => void;
	onRegenerateLastResponse?: () => void;
	onRetryLastResponse?: () => void;
	onStop?: () => void;
	onSubmit: ComponentProps<typeof AiChatPromptInput>["onSubmit"];
	onToolApprovalResponse?: ComponentProps<
		typeof AiChatMessageList
	>["onToolApprovalResponse"];
	status: AiChatStatus;
	threadId: string;
}) {
	return (
		<>
			<Conversation className="min-h-0">
				<ConversationContent
					scrollClassName="min-h-0 overscroll-contain"
					className="gap-5 px-4 pt-14 pb-5"
				>
					<AiChatMessageList
						isLoadingHistory={isLoadingHistory}
						isRecovering={isRecovering}
						messages={messages}
						status={status}
						workspaceId={context.workspaceId}
						onRegenerateLastResponse={onRegenerateLastResponse}
						onToolApprovalResponse={onToolApprovalResponse}
					/>
				</ConversationContent>
			</Conversation>

			<div className="px-4 pb-4">
				<div className="mx-auto w-full max-w-2xl">
					{error ? (
						<Alert variant="destructive" className="mb-3 py-2">
							<div className="flex flex-col gap-2">
								<AlertDescription className="min-w-0 text-destructive/90">
									{error.message}
								</AlertDescription>
								{onRetryLastResponse ? (
									<Button
										type="button"
										variant="outline"
										size="xs"
										className="self-end gap-1.5 border-border bg-background text-foreground hover:bg-muted hover:text-foreground"
										onClick={onRetryLastResponse}
									>
										<RotateCcw className="size-3" />
										Try again
									</Button>
								) : null}
							</div>
						</Alert>
					) : null}
					<AiChatPromptInput
						activeThreadId={threadId}
						context={context}
						getInspectorSnapshot={getInspectorSnapshot}
						modelId={modelId}
						status={isRecovering && status === "ready" ? "submitted" : status}
						onModelChange={onModelChange}
						onSubmit={onSubmit}
						onStop={onStop}
					/>
				</div>
			</div>
		</>
	);
}

function getChatMessageFromPrompt(
	message: AiChatPromptMessage,
): AiChatSendMessage | null {
	const trimmedText = message.text.trim();
	const parts = [
		...(trimmedText ? [{ type: "text" as const, text: trimmedText }] : []),
		...message.files,
	];

	if (parts.length === 0) {
		return null;
	}

	return { role: "user", parts };
}
