import { RefreshCw } from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { VList, type VListHandle } from "virtua";

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
	const virtualListRef = useRef<VListHandle>(null);
	const initialBottomScrollAppliedRef = useRef(false);
	const pinnedUserMessageIdRef = useRef<string | null>(null);
	const [pinnedBlankSize, setPinnedBlankSize] = useState(0);
	const [pinnedUserSize, setPinnedUserSize] = useState(0);
	const [selectedText, setSelectedText] = useState<SelectedText | null>(null);
	const addSelectedMention = useWorkspaceUiStore(
		(state) => state.addSelectedMention,
	);
	const latestUserMessage = getLatestUserMessage(messages);
	const latestUserMessageIndex = latestUserMessage
		? messages.findIndex((message) => message.id === latestUserMessage.id)
		: -1;
	const latestUserMessageId = latestUserMessage?.id;
	const bottomRowIndex =
		messages.length > 0
			? messages.length + (isRecovering ? 1 : 0) + (showThinking ? 1 : 0) - 1
			: -1;
	const pinnedSpacerMinHeight = Math.max(0, pinnedBlankSize - pinnedUserSize);
	const pinnedSpacerStyle =
		pinnedSpacerMinHeight > 0
			? { minHeight: pinnedSpacerMinHeight }
			: undefined;
	const measurePinnedUserRow = useCallback((element: HTMLDivElement | null) => {
		if (!element) {
			return;
		}

		const nextSize = element.getBoundingClientRect().height;
		setPinnedUserSize((currentSize) =>
			currentSize === nextSize ? currentSize : nextSize,
		);
	}, []);

	useEffect(() => {
		const updateSelection = () => {
			setSelectedText(getSelectedText(listRef.current));
		};

		document.addEventListener("selectionchange", updateSelection);

		return () => {
			document.removeEventListener("selectionchange", updateSelection);
		};
	}, []);

	useLayoutEffect(() => {
		if (initialBottomScrollAppliedRef.current || isLoadingHistory) {
			return;
		}

		if (bottomRowIndex < 0) {
			if (!isRecovering && !showThinking) {
				pinnedUserMessageIdRef.current = null;
				initialBottomScrollAppliedRef.current = true;
			}
			return;
		}

		pinnedUserMessageIdRef.current = latestUserMessageId ?? null;
		virtualListRef.current?.scrollToIndex(bottomRowIndex, { align: "end" });
		initialBottomScrollAppliedRef.current = true;
	}, [
		bottomRowIndex,
		isLoadingHistory,
		isRecovering,
		latestUserMessageId,
		showThinking,
	]);

	useEffect(() => {
		if (
			!latestUserMessageId ||
			latestUserMessageIndex < 0 ||
			(status !== "submitted" && status !== "streaming") ||
			pinnedUserMessageIdRef.current === latestUserMessageId
		) {
			return;
		}

		pinnedUserMessageIdRef.current = latestUserMessageId;
		setPinnedUserSize(0);

		const frame = requestAnimationFrame(() => {
			const virtualList = virtualListRef.current;

			setPinnedBlankSize(
				virtualList?.viewportSize ||
					listRef.current?.parentElement?.clientHeight ||
					0,
			);
			virtualList?.scrollToIndex(latestUserMessageIndex, {
				align: "start",
				smooth: true,
			});
		});

		return () => {
			cancelAnimationFrame(frame);
		};
	}, [latestUserMessageId, latestUserMessageIndex, status]);

	if (messages.length === 0) {
		if (isLoadingHistory) {
			return (
				<AiChatMessageListFallback>
					<AiChatThreadSkeleton />
				</AiChatMessageListFallback>
			);
		}

		if (isRecovering) {
			return (
				<AiChatMessageListFallback>
					<RecoveringAssistantMessage />
				</AiChatMessageListFallback>
			);
		}

		if (showThinking) {
			return (
				<AiChatMessageListFallback>
					<SubmittedAssistantMessage />
				</AiChatMessageListFallback>
			);
		}

		return (
			<AiChatMessageListFallback>
				<ConversationEmptyState
					className="min-h-[min(32rem,calc(100vh-12rem))] border-0 p-6"
					title="Start a workspace chat"
					description="Ask about the current workspace."
				/>
			</AiChatMessageListFallback>
		);
	}

	return (
		<div ref={listRef} className="contents">
			<VList
				ref={virtualListRef}
				className="min-h-0 flex-1 overscroll-contain px-4 pt-5 pb-5"
				style={{ height: "100%" }}
				bufferSize={600}
			>
				{messages.map((message, index) => (
					<div
						key={message.id}
						ref={
							message.id === latestUserMessageId
								? measurePinnedUserRow
								: undefined
						}
						className="pb-5"
						style={
							!isRecovering &&
							!showThinking &&
							index === messages.length - 1 &&
							message.role === "assistant"
								? pinnedSpacerStyle
								: undefined
						}
					>
						<AiChatMessageRow
							isRegenerable={message.id === regenerableAssistantMessageId}
							isRequestError={message.id === requestErrorAssistantMessageId}
							isStreaming={message.id === streamingAssistantMessageId}
							message={message}
							onRegenerate={onRegenerateLastResponse}
						/>
					</div>
				))}
				{isRecovering ? (
					<div
						key="recovering"
						className="pb-5"
						style={showThinking ? undefined : pinnedSpacerStyle}
					>
						<RecoveringAssistantMessage />
					</div>
				) : null}
				{showThinking ? (
					<div key="thinking" className="pb-5" style={pinnedSpacerStyle}>
						<SubmittedAssistantMessage />
					</div>
				) : null}
			</VList>
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

function AiChatMessageListFallback({ children }: { children: ReactNode }) {
	return <div className="min-h-0 flex-1 px-4 pt-5 pb-5">{children}</div>;
}

function getLatestUserMessage(messages: AiChatMessage[]) {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];

		if (message?.role === "user") {
			return message;
		}
	}
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
