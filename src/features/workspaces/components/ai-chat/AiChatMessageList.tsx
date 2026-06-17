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
} from "#/features/workspaces/components/ai-chat/types";
import { WorkspaceFloatingAskSelectionMenu } from "#/features/workspaces/components/WorkspaceFloatingAskSelectionMenu";
import { createAssistantResponseSelectedMention } from "#/features/workspaces/model/workspace-selected-mentions";
import {
	getRangeClientRect,
	type SelectionRect,
} from "#/features/workspaces/model/workspace-selection-geometry";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";

type SelectedText = {
	rect: SelectionRect;
	text: string;
};

interface AiChatMessageListProps {
	isLoadingHistory?: boolean;
	isRecovering?: boolean;
	messages: AiChatMessage[];
	onRegenerateLastResponse?: () => void;
	showThinking?: boolean;
	status: AiChatStatus;
	workspaceId: string;
}

export default function AiChatMessageList({
	isLoadingHistory = false,
	isRecovering = false,
	messages,
	onRegenerateLastResponse,
	showThinking = false,
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
	const [selectedText, setSelectedText] = useState<SelectedText | null>(null);
	const addSelectedMention = useWorkspaceUiStore(
		(state) => state.addSelectedMention,
	);

	useEffect(() => {
		const updateSelection = () => {
			setSelectedText(getSelectedText(listRef.current));
		};

		document.addEventListener("selectionchange", updateSelection);

		return () => {
			document.removeEventListener("selectionchange", updateSelection);
		};
	}, []);

	if (messages.length === 0) {
		if (isLoadingHistory) {
			return <AiChatThreadSkeleton />;
		}

		if (isRecovering) {
			return <RecoveringAssistantMessage />;
		}

		if (showThinking) {
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
				/>
			))}
			{isRecovering ? <RecoveringAssistantMessage /> : null}
			{showThinking ? <SubmittedAssistantMessage /> : null}
			{selectedText ? (
				<WorkspaceFloatingAskSelectionMenu
					rect={selectedText.rect}
					onAsk={() => {
						addSelectedMention(
							workspaceId,
							createAssistantResponseSelectedMention({
								text: selectedText.text,
							}),
						);
						window.getSelection()?.removeAllRanges();
						setSelectedText(null);
					}}
				/>
			) : null}
		</div>
	);
}

function getSelectedText(root: HTMLElement | null): SelectedText | null {
	const selection = window.getSelection();

	if (!root || !selection || selection.rangeCount === 0) {
		return null;
	}

	const anchorNode = selection.anchorNode;
	const text = selection.toString().trim();

	if (!anchorNode || !root.contains(anchorNode) || !text) {
		return null;
	}

	const rect = getRangeClientRect(selection.getRangeAt(0), null);
	return rect ? { rect, text } : null;
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
