import { isToolUIPart } from "ai";
import { Copy, FileText, LinkIcon, RotateCcw } from "lucide-react";

import { ConversationEmptyState } from "#/components/ai-elements/conversation";
import {
	Message,
	MessageAction,
	MessageActions,
	MessageContent,
	MessageResponse,
	MessageToolbar,
} from "#/components/ai-elements/message";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "#/components/ai-elements/reasoning";
import { Shimmer } from "#/components/ai-elements/shimmer";
import { Button } from "#/components/ui/button";
import AiChatThreadSkeleton from "#/features/workspaces/components/ai-chat/AiChatThreadSkeleton";
import AiChatToolCard from "#/features/workspaces/components/ai-chat/AiChatToolCard";
import type {
	AiChatMessage,
	AiChatMessagePart,
	AiChatStatus,
	AiChatToolApprovalResponse,
} from "#/features/workspaces/components/ai-chat/types";
import { cn } from "#/lib/utils";

interface AiChatMessageListProps {
	isLoadingHistory?: boolean;
	messages: AiChatMessage[];
	onRegenerateLastResponse?: () => void;
	onToolApprovalResponse?: (response: AiChatToolApprovalResponse) => void;
	status: AiChatStatus;
}

export default function AiChatMessageList({
	isLoadingHistory = false,
	messages,
	onRegenerateLastResponse,
	onToolApprovalResponse,
	status,
}: AiChatMessageListProps) {
	if (messages.length === 0) {
		if (isLoadingHistory) {
			return <AiChatThreadSkeleton />;
		}

		if (status === "submitted") {
			return (
				<Message from="assistant" className="max-w-full">
					<MessageContent>
						<Shimmer duration={1}>{"Thinking\u2026"}</Shimmer>
					</MessageContent>
				</Message>
			);
		}

		return (
			<ConversationEmptyState
				className="min-h-[min(32rem,calc(100vh-12rem))] border-0 p-6"
				title="Start a workspace chat"
				description="Ask about the current workspace."
			/>
		);
	}

	const lastMessage = messages.at(-1);
	const regenerableAssistantMessageId =
		status === "ready" && lastMessage?.role === "assistant"
			? lastMessage.id
			: undefined;
	const streamingAssistantMessageId =
		status === "streaming" && lastMessage?.role === "assistant"
			? lastMessage.id
			: undefined;

	return (
		<>
			{messages.map((message) => (
				<AiChatMessageRow
					key={message.id}
					isRegenerable={message.id === regenerableAssistantMessageId}
					isStreaming={message.id === streamingAssistantMessageId}
					message={message}
					onRegenerate={onRegenerateLastResponse}
					onToolApprovalResponse={onToolApprovalResponse}
				/>
			))}
			{status === "submitted" ? (
				<Message from="assistant" className="max-w-full">
					<MessageContent>
						<Shimmer duration={1}>{"Thinking\u2026"}</Shimmer>
					</MessageContent>
				</Message>
			) : null}
		</>
	);
}

function AiChatMessageRow({
	isRegenerable,
	isStreaming,
	message,
	onRegenerate,
	onToolApprovalResponse,
}: {
	isRegenerable: boolean;
	isStreaming: boolean;
	message: AiChatMessage;
	onRegenerate?: () => void;
	onToolApprovalResponse?: (response: AiChatToolApprovalResponse) => void;
}) {
	const isAssistant = message.role === "assistant";
	const visibleParts = message.parts.filter(shouldShowMessagePart);
	const copyableText = getCopyableMessageText(message);

	return (
		<Message
			from={message.role}
			className={cn(
				isAssistant ? "max-w-full" : "max-w-[88%]",
				message.role === "user" && "ml-auto",
			)}
		>
			<div className="min-w-0 max-w-full">
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

function getCopyableMessageText(message: AiChatMessage) {
	return message.parts
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n\n")
		.trim();
}

async function copyTextToClipboard(text: string) {
	try {
		await navigator.clipboard.writeText(text);
	} catch (error) {
		console.warn("[AiChatMessageList] Failed to copy response", error);
	}
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

	if (part.type === "text" || part.type === "reasoning") {
		return `${messageId}-${part.type}-${index}`;
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

function AiChatMessagePartView({
	part,
	onToolApprovalResponse,
}: {
	part: AiChatMessagePart;
	onToolApprovalResponse?: (response: AiChatToolApprovalResponse) => void;
}) {
	if (part.type === "text") {
		return <MessageResponse>{part.text}</MessageResponse>;
	}

	if (part.type === "reasoning") {
		return (
			<Reasoning
				className="mb-3"
				defaultOpen={false}
				isStreaming={part.state === "streaming"}
			>
				<ReasoningTrigger />
				<ReasoningContent>{part.text}</ReasoningContent>
			</Reasoning>
		);
	}

	if (isToolUIPart(part)) {
		return (
			<AiChatToolCard
				part={part}
				onToolApprovalResponse={onToolApprovalResponse}
			/>
		);
	}

	if (part.type === "file") {
		return (
			<div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
				<FileText className="size-4" />
				<span className="min-w-0 truncate">
					{part.filename ?? part.mediaType}
				</span>
			</div>
		);
	}

	if (part.type === "source-url") {
		return (
			<a
				className="inline-flex max-w-full items-center gap-2 text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
				href={part.url}
				rel="noreferrer"
				target="_blank"
			>
				<LinkIcon className="size-4 shrink-0" />
				<span className="truncate">{part.title ?? part.url}</span>
			</a>
		);
	}

	if (part.type === "source-document") {
		return (
			<div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
				<FileText className="size-4" />
				<span className="min-w-0 truncate">{part.filename ?? part.title}</span>
			</div>
		);
	}

	return null;
}
