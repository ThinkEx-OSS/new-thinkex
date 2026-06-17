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
import { AiChatAssistantPending } from "#/features/workspaces/components/ai-chat/AiChatAssistantPending";
import AiChatMessageRow from "#/features/workspaces/components/ai-chat/AiChatMessageRow";
import AiChatThreadSkeleton from "#/features/workspaces/components/ai-chat/AiChatThreadSkeleton";
import {
	type AiChatPresentation,
	type AssistantRowDisplay,
	getAssistantRowDisplay,
} from "#/features/workspaces/components/ai-chat/ai-chat-display-state";
import type { AiChatMessage } from "#/features/workspaces/components/ai-chat/types";
import { WorkspaceFloatingAskSelectionMenu } from "#/features/workspaces/components/WorkspaceFloatingAskSelectionMenu";
import { stageComposerQuote } from "#/features/workspaces/composer/workspace-composer-actions";
import { createAssistantResponseSelectedQuote } from "#/features/workspaces/model/workspace-selected-quotes";
import {
	getRangeClientRect,
	type SelectionRect,
} from "#/features/workspaces/model/workspace-selection-geometry";

type SelectedText = {
	rect: SelectionRect;
	text: string;
};

type AiChatListRow =
	| {
			display: AssistantRowDisplay | null;
			message: AiChatMessage;
			type: "message";
	  }
	| {
			pending: NonNullable<AiChatPresentation["tailPending"]>;
			type: "pending";
	  };

interface AiChatMessageListProps {
	isLoadingHistory?: boolean;
	messages: AiChatMessage[];
	onRegenerateLastResponse?: () => void;
	presentation: AiChatPresentation;
	workspaceId: string;
}

export default function AiChatMessageList({
	isLoadingHistory = false,
	messages,
	onRegenerateLastResponse,
	presentation,
	workspaceId,
}: AiChatMessageListProps) {
	const { lastAssistantMessageId, status, tailPending } = presentation;
	const rows = getAiChatListRows(messages, presentation);
	const hasPendingTail = tailPending !== null;
	const listRef = useRef<HTMLDivElement>(null);
	const virtualListRef = useRef<VListHandle>(null);
	const initialBottomScrollAppliedRef = useRef(false);
	const pinnedUserMessageIdRef = useRef<string | null>(null);
	const [pinnedBlankSize, setPinnedBlankSize] = useState(0);
	const [pinnedUserSize, setPinnedUserSize] = useState(0);
	const [selectedText, setSelectedText] = useState<SelectedText | null>(null);
	const latestUserMessage = getLatestUserMessage(messages);
	const latestUserMessageId = latestUserMessage?.id;
	const latestUserMessageIndex = latestUserMessageId
		? rows.findIndex(
				(row) =>
					row.type === "message" && row.message.id === latestUserMessageId,
			)
		: -1;
	const bottomRowIndex = rows.length - 1;
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
	const pinActive = status === "submitted" || status === "streaming";

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
			if (!hasPendingTail) {
				pinnedUserMessageIdRef.current = null;
				initialBottomScrollAppliedRef.current = true;
			}
			return;
		}

		pinnedUserMessageIdRef.current = latestUserMessageId ?? null;
		virtualListRef.current?.scrollToIndex(bottomRowIndex, { align: "end" });
		initialBottomScrollAppliedRef.current = true;
	}, [bottomRowIndex, hasPendingTail, isLoadingHistory, latestUserMessageId]);

	useEffect(() => {
		if (
			!latestUserMessageId ||
			latestUserMessageIndex < 0 ||
			!pinActive ||
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
	}, [latestUserMessageId, latestUserMessageIndex, pinActive]);

	if (messages.length === 0) {
		if (isLoadingHistory) {
			return (
				<AiChatMessageListFallback>
					<AiChatThreadSkeleton />
				</AiChatMessageListFallback>
			);
		}

		if (tailPending) {
			return (
				<AiChatMessageListFallback>
					<AiChatAssistantPending pending={tailPending} />
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
				{rows.map((row, index) => {
					if (row.type === "pending") {
						return (
							<div
								key="assistant-pending"
								className="pb-5"
								style={pinnedSpacerStyle}
							>
								<AiChatAssistantPending pending={row.pending} />
							</div>
						);
					}

					const { display, message } = row;
					const isLastMessage = index === rows.length - 1;
					const applyPinnedSpacer =
						!hasPendingTail && isLastMessage && message.role === "assistant";

					return (
						<div
							key={message.id}
							ref={
								message.id === latestUserMessageId
									? measurePinnedUserRow
									: undefined
							}
							className="pb-5"
							style={applyPinnedSpacer ? pinnedSpacerStyle : undefined}
						>
							<AiChatMessageRow
								display={display}
								isRegenerable={
									message.id === lastAssistantMessageId && status === "ready"
								}
								isStreaming={
									message.id === lastAssistantMessageId &&
									status === "streaming"
								}
								message={message}
								onRegenerate={onRegenerateLastResponse}
							/>
						</div>
					);
				})}
			</VList>
			{selectedText ? (
				<WorkspaceFloatingAskSelectionMenu
					rect={selectedText.rect}
					onAsk={() => {
						stageComposerQuote(
							workspaceId,
							createAssistantResponseSelectedQuote({
								text: selectedText.text,
							}),
							{ revealChat: false },
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

function getAiChatListRows(
	messages: AiChatMessage[],
	presentation: AiChatPresentation,
): AiChatListRow[] {
	const rows: AiChatListRow[] = [];

	for (const message of messages) {
		const display = getAssistantRowDisplay(message, presentation);

		if (display?.kind === "hidden") {
			continue;
		}

		rows.push({
			display,
			message,
			type: "message",
		});
	}

	if (presentation.tailPending) {
		rows.push({
			pending: presentation.tailPending,
			type: "pending",
		});
	}

	return rows;
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
