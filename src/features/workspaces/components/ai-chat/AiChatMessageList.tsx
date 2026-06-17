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
	getAssistantRowDisplay,
} from "#/features/workspaces/components/ai-chat/ai-chat-display-state";
import type { AiChatMessage } from "#/features/workspaces/components/ai-chat/types";
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
	const {
		regenerableAssistantMessageId,
		showEphemeralAwaitingFirstToken,
		showEphemeralRecovering,
		streamingAssistantMessageId,
	} = presentation;
	const hasEphemeralTail =
		showEphemeralAwaitingFirstToken || showEphemeralRecovering;
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
	const ephemeralRowCount =
		(showEphemeralRecovering ? 1 : 0) +
		(showEphemeralAwaitingFirstToken ? 1 : 0);
	const bottomRowIndex =
		messages.length > 0 ? messages.length + ephemeralRowCount - 1 : -1;
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
	const { lifecycle } = presentation;
	const pinActive =
		lifecycle.status === "submitted" || lifecycle.status === "streaming";

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
			if (!hasEphemeralTail) {
				pinnedUserMessageIdRef.current = null;
				initialBottomScrollAppliedRef.current = true;
			}
			return;
		}

		pinnedUserMessageIdRef.current = latestUserMessageId ?? null;
		virtualListRef.current?.scrollToIndex(bottomRowIndex, { align: "end" });
		initialBottomScrollAppliedRef.current = true;
	}, [bottomRowIndex, hasEphemeralTail, isLoadingHistory, latestUserMessageId]);

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

		if (showEphemeralRecovering) {
			return (
				<AiChatMessageListFallback>
					<AiChatAssistantPending pending="recovering" />
				</AiChatMessageListFallback>
			);
		}

		if (showEphemeralAwaitingFirstToken) {
			return (
				<AiChatMessageListFallback>
					<AiChatAssistantPending pending="thinking" />
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
				{messages.map((message, index) => {
					const display = getAssistantRowDisplay(message, presentation);
					const isLastMessage = index === messages.length - 1;
					const applyPinnedSpacer =
						!hasEphemeralTail && isLastMessage && message.role === "assistant";

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
								isRegenerable={message.id === regenerableAssistantMessageId}
								isStreaming={message.id === streamingAssistantMessageId}
								message={message}
								onRegenerate={onRegenerateLastResponse}
							/>
						</div>
					);
				})}
				{showEphemeralRecovering ? (
					<div key="recovering" className="pb-5" style={pinnedSpacerStyle}>
						<AiChatAssistantPending pending="recovering" />
					</div>
				) : null}
				{showEphemeralAwaitingFirstToken ? (
					<div key="thinking" className="pb-5" style={pinnedSpacerStyle}>
						<AiChatAssistantPending pending="thinking" />
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
