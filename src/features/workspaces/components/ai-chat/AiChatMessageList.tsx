import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import { WorkspaceFloatingAskSelectionMenu } from "#/features/workspaces/components/WorkspaceFloatingAskSelectionMenu";
import { createAssistantResponseSelectedMention } from "#/features/workspaces/model/workspace-selected-mentions";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";

const ASSISTANT_MESSAGE_SELECTION_ATTRIBUTE = "data-ai-assistant-message-id";

type AssistantSelectionState = {
	rect: DOMRect;
	text: string;
};

interface AiChatMessageListProps {
	isLoadingHistory?: boolean;
	isRecovering?: boolean;
	messages: AiChatMessage[];
	onRegenerateLastResponse?: () => void;
	onToolApprovalResponse?: (response: AiChatToolApprovalResponse) => void;
	status: AiChatStatus;
	workspaceId: string;
}

export default function AiChatMessageList({
	isLoadingHistory = false,
	isRecovering = false,
	messages,
	onRegenerateLastResponse,
	onToolApprovalResponse,
	status,
	workspaceId,
}: AiChatMessageListProps) {
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
	const listRef = useRef<HTMLDivElement>(null);
	const [selection, setSelection] = useState<AssistantSelectionState | null>(
		null,
	);
	const addSelectedMention = useWorkspaceUiStore(
		(state) => state.addSelectedMention,
	);

	useEffect(() => {
		const updateSelection = () => {
			setSelection(
				getAssistantSelectionState({
					root: listRef.current,
					streamingAssistantMessageId,
				}),
			);
		};

		document.addEventListener("selectionchange", updateSelection);
		document.addEventListener("scroll", updateSelection, true);
		window.addEventListener("resize", updateSelection);

		return () => {
			document.removeEventListener("selectionchange", updateSelection);
			document.removeEventListener("scroll", updateSelection, true);
			window.removeEventListener("resize", updateSelection);
		};
	}, [streamingAssistantMessageId]);

	if (messages.length === 0) {
		if (isLoadingHistory) {
			return <AiChatThreadSkeleton />;
		}

		if (isRecovering) {
			return <RecoveringAssistantMessage />;
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

	return (
		<div ref={listRef} className="contents">
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
			{isRecovering ? <RecoveringAssistantMessage /> : null}
			{status === "submitted" ? <SubmittedAssistantMessage /> : null}
			{selection ? (
				<WorkspaceFloatingAskSelectionMenu
					rect={selection.rect}
					onAsk={() => {
						addSelectedMention(
							workspaceId,
							createAssistantResponseSelectedMention({
								text: selection.text,
							}),
						);
						window.getSelection()?.removeAllRanges();
						setSelection(null);
					}}
				/>
			) : null}
		</div>
	);
}

function getAssistantSelectionState({
	root,
	streamingAssistantMessageId,
}: {
	root: HTMLElement | null;
	streamingAssistantMessageId?: string;
}): AssistantSelectionState | null {
	const selection = window.getSelection();

	if (!root || !selection || selection.rangeCount === 0) {
		return null;
	}

	const text = selection.toString().trim();
	const anchorRoot = getAssistantSelectionRoot(selection.anchorNode, root);
	const focusRoot = getAssistantSelectionRoot(selection.focusNode, root);

	if (!text || !anchorRoot || anchorRoot !== focusRoot) {
		return null;
	}

	const messageId = anchorRoot.getAttribute(
		ASSISTANT_MESSAGE_SELECTION_ATTRIBUTE,
	);

	if (!messageId || messageId === streamingAssistantMessageId) {
		return null;
	}

	const rect = getSelectionRangeRect(selection.getRangeAt(0));

	if (!rect) {
		return null;
	}

	return { rect, text };
}

function getAssistantSelectionRoot(node: Node | null, root: HTMLElement) {
	const element = node instanceof Element ? node : node?.parentElement;
	const assistantRoot = element?.closest<HTMLElement>(
		`[${ASSISTANT_MESSAGE_SELECTION_ATTRIBUTE}]`,
	);

	return assistantRoot && root.contains(assistantRoot) ? assistantRoot : null;
}

function getSelectionRangeRect(range: Range) {
	const rect = range.getBoundingClientRect();

	if (rect.width > 0 || rect.height > 0) {
		return rect;
	}

	const firstRect = Array.from(range.getClientRects()).find(
		(rect) => rect.width > 0 || rect.height > 0,
	);

	return firstRect ?? null;
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

function RecoveringAssistantMessage() {
	return (
		<Message from="assistant" className="max-w-full">
			<MessageContent>
				<div className="flex items-center gap-2 text-muted-foreground">
					<RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
					<Shimmer duration={1.4}>{"Recovering response\u2026"}</Shimmer>
				</div>
			</MessageContent>
		</Message>
	);
}
