import { isToolUIPart } from "ai";
import { Copy, RotateCcw } from "lucide-react";

import {
	Message,
	MessageAction,
	MessageActions,
	MessageContent,
	MessageToolbar,
} from "#/components/ai-elements/message";
import { Button } from "#/components/ui/button";
import { AiChatMessagePartView } from "#/features/workspaces/components/ai-chat/AiChatMessagePartView";
import type {
	AiChatMessage,
	AiChatMessagePart,
	AiChatToolApprovalResponse,
} from "#/features/workspaces/components/ai-chat/types";
import { cn } from "#/lib/utils";

export default function AiChatMessageRow({
	isRegenerable,
	isRequestError,
	isStreaming,
	message,
	onRegenerate,
	onToolApprovalResponse,
}: {
	isRegenerable: boolean;
	isRequestError: boolean;
	isStreaming: boolean;
	message: AiChatMessage;
	onRegenerate?: () => void;
	onToolApprovalResponse?: (response: AiChatToolApprovalResponse) => void;
}) {
	const isAssistant = message.role === "assistant";
	const visibleParts = message.parts.filter(shouldShowMessagePart);
	const copyableText = getCopyableMessageText(message);

	if (isAssistant && visibleParts.length === 0 && isRequestError) {
		return null;
	}

	return (
		<Message
			from={message.role}
			className={cn(
				isAssistant ? "max-w-full" : "max-w-[88%]",
				message.role === "user" && "ml-auto",
			)}
		>
			<div className="min-w-0 max-w-full">
				<div
					data-ai-assistant-message-id={
						isAssistant && !isStreaming ? message.id : undefined
					}
				>
					<MessageContent>
						{visibleParts.length > 0 ? (
							visibleParts.map((part, index) => (
								<AiChatMessagePartView
									key={getMessagePartKey(message.id, part, index)}
									onToolApprovalResponse={onToolApprovalResponse}
									part={part}
								/>
							))
						) : isAssistant ? (
							<EmptyAssistantResponse
								canRegenerate={isRegenerable && Boolean(onRegenerate)}
								onRegenerate={onRegenerate}
							/>
						) : null}
					</MessageContent>
				</div>
				{isAssistant && visibleParts.length > 0 && !isStreaming ? (
					<MessageToolbar className="mt-2 justify-start">
						<MessageActions className="-ms-2.5">
							{copyableText ? (
								<MessageAction
									tooltip="Copy response"
									label="Copy response"
									size="icon-sm"
									className="text-muted-foreground/70 hover:text-foreground"
									onClick={() => {
										void copyTextToClipboard(copyableText);
									}}
								>
									<Copy className="size-3.5" />
								</MessageAction>
							) : null}
							{isRegenerable && onRegenerate ? (
								<MessageAction
									tooltip="Regenerate response"
									label="Regenerate response"
									onClick={onRegenerate}
									className="text-muted-foreground/70 hover:text-foreground"
								>
									<RotateCcw className="size-3.5" />
								</MessageAction>
							) : null}
						</MessageActions>
					</MessageToolbar>
				) : null}
			</div>
		</Message>
	);
}

function EmptyAssistantResponse({
	canRegenerate,
	onRegenerate,
}: {
	canRegenerate: boolean;
	onRegenerate?: () => void;
}) {
	return (
		<div className="flex flex-col items-start gap-2 text-muted-foreground text-sm">
			<p>The AI didn't return a response.</p>
			{canRegenerate ? (
				<Button
					type="button"
					variant="outline"
					size="xs"
					onClick={onRegenerate}
					className="gap-1.5"
				>
					<RotateCcw className="size-3" />
					Try again
				</Button>
			) : null}
		</div>
	);
}

function getCopyableMessageText(message: AiChatMessage) {
	const textParts: string[] = [];

	for (const part of message.parts) {
		if (part.type === "text") {
			textParts.push(part.text);
		}
	}

	return textParts.join("\n\n").trim();
}

async function copyTextToClipboard(text: string) {
	try {
		await navigator.clipboard.writeText(text);
	} catch (error) {
		console.warn("[AiChatMessageRow] Failed to copy response", error);
	}
}

function getMessagePartKey(
	messageId: string,
	part: AiChatMessagePart,
	index: number,
) {
	if (isToolUIPart(part)) {
		return `${messageId}-tool-${part.toolCallId}`;
	}

	if (part.type === "source-url" || part.type === "source-document") {
		return `${messageId}-${part.type}-${part.sourceId}`;
	}

	if (part.type === "file") {
		return `${messageId}-file-${part.url}`;
	}

	return `${messageId}-${part.type}-${index}`;
}

function shouldShowMessagePart(part: AiChatMessagePart) {
	if (part.type === "text" || part.type === "reasoning") {
		if (part.type === "reasoning" && part.state !== "streaming") {
			return false;
		}

		return part.text.length > 0 || part.state === "streaming";
	}

	return true;
}
