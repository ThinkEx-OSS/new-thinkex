import type {
	ChatErrorClassification,
	ChatErrorContext,
} from "@cloudflare/think";
import { AlertCircle, RotateCcw } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Message, MessageContent } from "#/components/ai-elements/message";
import ThinkExLogo from "#/components/ThinkExLogo";
import { Button } from "#/components/ui/button";
import { AiChatAssistantPending } from "#/features/workspaces/components/ai-chat/AiChatAssistantPending";
import AiChatMessageRow from "#/features/workspaces/components/ai-chat/AiChatMessageRow";
import AiChatTranscriptRail from "#/features/workspaces/components/ai-chat/AiChatTranscriptRail";
import {
	type AiChatPresentation,
	type AssistantRowDisplay,
	getAssistantRowDisplay,
	isAiChatStreamActive,
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

export interface AiChatAssistantErrorState {
	classification?: ChatErrorClassification | null;
	stage?: ChatErrorContext["stage"] | null;
}

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
	assistantError?: AiChatAssistantErrorState | null;
	messages: AiChatMessage[];
	onRegenerateLastResponse?: () => void;
	presentation: AiChatPresentation;
	workspaceId: string;
}

export default function AiChatMessageList({
	assistantError,
	messages,
	onRegenerateLastResponse,
	presentation,
	workspaceId,
}: AiChatMessageListProps) {
	const { lastAssistantMessageId, status, tailPending } = presentation;
	const rows = getAiChatListRows(messages, presentation);
	const hasAssistantContent = hasLatestAssistantContent(rows);
	const listRef = useRef<HTMLDivElement>(null);
	const [selectedText, setSelectedText] = useState<SelectedText | null>(null);

	useEffect(() => {
		const updateSelection = () => {
			setSelectedText(getSelectedText(listRef.current));
		};

		document.addEventListener("selectionchange", updateSelection);

		return () => {
			document.removeEventListener("selectionchange", updateSelection);
		};
	}, []);

	if (messages.length === 0 && !assistantError) {
		if (tailPending) {
			return (
				<AiChatMessageListFallback>
					<AiChatAssistantPending pending={tailPending} />
				</AiChatMessageListFallback>
			);
		}

		return (
			<AiChatMessageListFallback>
				<div className="flex min-h-[min(32rem,calc(100vh-12rem))] flex-col items-center justify-center gap-3 p-6">
					<ThinkExLogo size={32} />
					<p className="text-sm text-muted-foreground">Start a new chat</p>
				</div>
			</AiChatMessageListFallback>
		);
	}

	return (
		<div ref={listRef} className="contents">
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-5">
				{rows.map((row) => {
					if (row.type === "pending") {
						return (
							<AiChatTranscriptRail
								key="assistant-pending"
								className="pb-5"
								withTopInset={rows[0] === row}
							>
								<AiChatAssistantPending pending={row.pending} />
							</AiChatTranscriptRail>
						);
					}

					const { display, message } = row;
					return (
						<AiChatTranscriptRail
							key={message.id}
							className="pb-5"
							withTopInset={rows[0] === row}
						>
							<AiChatMessageRow
								display={display}
								isRegenerable={
									message.id === lastAssistantMessageId && status === "ready"
								}
								isStreaming={
									message.id === lastAssistantMessageId &&
									isAiChatStreamActive(status)
								}
								message={message}
								onRegenerate={onRegenerateLastResponse}
							/>
						</AiChatTranscriptRail>
					);
				})}
				{assistantError ? (
					<AiChatTranscriptRail
						className="pb-5"
						withTopInset={rows.length === 0}
					>
						<AiChatAssistantError
							canRetry={Boolean(onRegenerateLastResponse)}
							errorState={assistantError}
							hasAssistantContent={hasAssistantContent}
							onRetry={onRegenerateLastResponse}
						/>
					</AiChatTranscriptRail>
				) : null}
			</div>
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
	return (
		<div className="min-h-0 flex-1 px-4 pt-5 pb-5">
			<AiChatTranscriptRail withTopInset>{children}</AiChatTranscriptRail>
		</div>
	);
}

function AiChatAssistantError({
	canRetry,
	errorState,
	hasAssistantContent,
	onRetry,
}: {
	canRetry: boolean;
	errorState: AiChatAssistantErrorState;
	hasAssistantContent: boolean;
	onRetry?: () => void;
}) {
	return (
		<Message from="assistant" className="max-w-full">
			<MessageContent>
				<div className="flex flex-col items-start gap-3 rounded-md border border-destructive/25 bg-destructive/8 p-4">
					<div className="flex items-start gap-2">
						<AlertCircle
							className="mt-0.5 size-4 shrink-0 text-destructive"
							aria-hidden="true"
						/>
						<p className="text-sm text-foreground">
							{getChatErrorMessage({
								errorState,
								hasAssistantContent,
							})}
						</p>
					</div>
					{canRetry ? (
						<Button
							type="button"
							variant="outline"
							size="xs"
							className="gap-1.5"
							onClick={onRetry}
						>
							<RotateCcw className="size-3" />
							Try again
						</Button>
					) : null}
				</div>
			</MessageContent>
		</Message>
	);
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

function hasLatestAssistantContent(rows: AiChatListRow[]) {
	for (let i = rows.length - 1; i >= 0; i -= 1) {
		const row = rows[i];

		if (row.type !== "message" || row.message.role !== "assistant") {
			continue;
		}

		return row.display?.kind === "content" && row.display.parts.length > 0;
	}

	return false;
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

function getChatErrorMessage({
	errorState,
	hasAssistantContent,
}: {
	errorState: AiChatAssistantErrorState;
	hasAssistantContent: boolean;
}) {
	if (errorState.classification === "context_overflow") {
		return "This chat got too large to finish. Try again or start a new chat.";
	}

	if (errorState.stage === "recovery") {
		return hasAssistantContent
			? "The response was interrupted before it finished."
			: "The response was interrupted before it could start.";
	}

	return hasAssistantContent
		? "Something went wrong before the response could finish."
		: "Something went wrong before the response could be generated.";
}
