import { ConversationEmptyState } from "#/components/ai-elements/conversation";
import { Message, MessageContent } from "#/components/ai-elements/message";
import { Shimmer } from "#/components/ai-elements/shimmer";
import AiChatMessageRow from "#/features/workspaces/components/ai-chat/AiChatMessageRow";
import AiChatThreadSkeleton from "#/features/workspaces/components/ai-chat/AiChatThreadSkeleton";
import type {
	AiChatMessage,
	AiChatStatus,
	AiChatToolApprovalResponse,
} from "#/features/workspaces/components/ai-chat/types";

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
			return <SubmittedAssistantMessage />;
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
	const requestErrorAssistantMessageId =
		status === "error" && lastMessage?.role === "assistant"
			? lastMessage.id
			: undefined;

	return (
		<>
			{messages.map((message) => (
				<AiChatMessageRow
					key={message.id}
					isRegenerable={message.id === regenerableAssistantMessageId}
					isRequestError={message.id === requestErrorAssistantMessageId}
					isStreaming={message.id === streamingAssistantMessageId}
					message={message}
					onRegenerate={onRegenerateLastResponse}
					onToolApprovalResponse={onToolApprovalResponse}
				/>
			))}
			{status === "submitted" ? <SubmittedAssistantMessage /> : null}
		</>
	);
}

function SubmittedAssistantMessage() {
	return (
		<Message from="assistant" className="max-w-full">
			<MessageContent>
				<Shimmer duration={1}>{"Thinking\u2026"}</Shimmer>
			</MessageContent>
		</Message>
	);
}
