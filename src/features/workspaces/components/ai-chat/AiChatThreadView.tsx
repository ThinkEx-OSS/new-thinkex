import { RotateCcw } from "lucide-react";

import {
	Conversation,
	ConversationContent,
} from "#/components/ai-elements/conversation";
import type { PromptInputMessage } from "#/components/ai-elements/prompt-input";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import type { AIInspectorSnapshot } from "#/features/workspaces/ai/ai-inspector";
import AiChatMessageList from "#/features/workspaces/components/ai-chat/AiChatMessageList";
import AiChatPromptInput from "#/features/workspaces/components/ai-chat/AiChatPromptInput";
import type {
	AiChatModelId,
	AiChatSendMessage,
} from "#/features/workspaces/components/ai-chat/types";
import { useWorkspaceAiChat } from "#/features/workspaces/components/ai-chat/useWorkspaceAiChat";
import type { WorkspaceAiContextScope } from "#/features/workspaces/model/workspace-ai-context";
import { buildWorkspaceAiContextSnapshot } from "#/features/workspaces/model/workspace-ai-context";
import { useWorkspaceAiComposerDraftStore } from "#/features/workspaces/state/workspace-ai-composer-draft-store";

export default function AiChatThreadView({
	context,
	getInspectorSnapshot,
	modelId,
	onModelChange,
	threadId,
}: {
	context: WorkspaceAiContextScope;
	getInspectorSnapshot?: (threadId: string) => Promise<AIInspectorSnapshot>;
	modelId: AiChatModelId;
	onModelChange: (modelId: AiChatModelId) => void;
	threadId: string;
}) {
	const chat = useWorkspaceAiChat({ modelId, threadId });
	const {
		error,
		inputStatus,
		messages,
		presentation,
		regenerate,
		sendMessage: sendChatMessage,
		stop,
	} = chat;
	const clearDraftArtifacts = useWorkspaceAiComposerDraftStore(
		(state) => state.clearDraftArtifacts,
	);
	const sendMessage = (message: PromptInputMessage) => {
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
			clearDraftArtifacts(context.workspaceId);
		}

		return didSend;
	};

	return (
		<div className="relative flex min-h-0 flex-1 flex-col">
			<Conversation className="min-h-0">
				<ConversationContent
					scrollClassName="min-h-0 overflow-hidden"
					className="p-0"
				>
					<AiChatMessageList
						messages={messages}
						presentation={presentation}
						workspaceId={context.workspaceId}
						onRegenerateLastResponse={regenerate}
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
								<Button
									type="button"
									variant="outline"
									size="xs"
									className="self-end gap-1.5 border-border bg-background text-foreground hover:bg-muted hover:text-foreground"
									onClick={regenerate}
								>
									<RotateCcw className="size-3" />
									Try again
								</Button>
							</div>
						</Alert>
					) : null}
					<AiChatPromptInput
						activeThreadId={threadId}
						context={context}
						getInspectorSnapshot={getInspectorSnapshot}
						modelId={modelId}
						status={inputStatus}
						onModelChange={onModelChange}
						onSubmit={sendMessage}
						onStop={stop}
					/>
				</div>
			</div>
		</div>
	);
}

function getChatMessageFromPrompt(
	message: PromptInputMessage,
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
