import { Plus, RotateCcw } from "lucide-react";
import type { ComponentProps } from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
	Conversation,
	ConversationContent,
	ConversationEmptyState,
} from "#/components/ai-elements/conversation";
import { Alert, AlertDescription } from "#/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import AiChatMessageList from "#/features/workspaces/components/ai-chat/AiChatMessageList";
import AiChatPanelToolbar from "#/features/workspaces/components/ai-chat/AiChatPanelToolbar";
import AiChatPromptInput from "#/features/workspaces/components/ai-chat/AiChatPromptInput";
import { AiChatPanelLoadingContent } from "#/features/workspaces/components/ai-chat/AiChatThreadSkeleton";
import { DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID } from "#/features/workspaces/components/ai-chat/constants";
import type {
	AiChatMessage,
	AiChatModelId,
	AiChatSendMessage,
	AiChatStatus,
} from "#/features/workspaces/components/ai-chat/types";
import { useWorkspaceAiChat } from "#/features/workspaces/components/ai-chat/useWorkspaceAiChat";
import {
	findWorkspaceAiChatThread,
	useWorkspaceAiChatThreads,
} from "#/features/workspaces/components/ai-chat/useWorkspaceAiChatThreads";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";

interface AiChatPanelProps {
	workspaceId: string;
}

type AiChatPromptMessage = Parameters<
	NonNullable<ComponentProps<typeof AiChatPromptInput>["onSubmit"]>
>[0];

export default function AiChatPanel({ workspaceId }: AiChatPanelProps) {
	const presentation = useWorkspaceUiStore(
		(state) => state.sessionsByWorkspaceId[workspaceId]?.presentation,
	);
	const activeThreadIdFromStore = useWorkspaceUiStore(
		(state) => state.sessionsByWorkspaceId[workspaceId]?.activeAiChatThreadId,
	);
	const closeChatPanel = useWorkspaceUiStore((state) => state.closeChatPanel);
	const maximizeChat = useWorkspaceUiStore((state) => state.maximizeChat);
	const restorePresentation = useWorkspaceUiStore(
		(state) => state.restorePresentation,
	);
	const setActiveAiChatThread = useWorkspaceUiStore(
		(state) => state.setActiveAiChatThread,
	);
	const isMaximized =
		presentation?.mode === "maximized" && presentation.pane.kind === "chat";
	const [modelId, setModelId] = useState<AiChatModelId>(
		DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
	);
	const [isDeleteThreadDialogOpen, setIsDeleteThreadDialogOpen] =
		useState(false);
	const [isSelectingNewThread, setIsSelectingNewThread] = useState(false);
	const [threadPendingDeletion, setThreadPendingDeletion] =
		useState<AiChatThreadForDialog>();
	const markingViewedThreadIdsRef = useRef<Set<string>>(new Set());
	const {
		createThread,
		deleteThread,
		isCreatingThread,
		isReady: areThreadsReady,
		markThreadViewed,
		threads,
	} = useWorkspaceAiChatThreads({ workspaceId });
	const activeThread = findWorkspaceAiChatThread(
		threads,
		activeThreadIdFromStore,
	);
	const selectedThread =
		isSelectingNewThread || isCreatingThread
			? undefined
			: (activeThread ?? (areThreadsReady ? threads[0] : undefined));
	const activeThreadId = selectedThread?.id;

	const selectThread = useCallback(
		(threadId: string | undefined) => {
			setActiveAiChatThread(workspaceId, threadId);
		},
		[setActiveAiChatThread, workspaceId],
	);

	const selectOrCreateNewChat = async (
		candidateThreads: typeof threads = threads,
	) => {
		if (isCreatingThread || isSelectingNewThread) {
			return;
		}

		const existingEmptyThread = candidateThreads.find(
			(thread) => !thread.lastUserMessageAt,
		);

		if (existingEmptyThread) {
			selectThread(existingEmptyThread.id);
			return;
		}

		setIsSelectingNewThread(true);

		const thread = await createThread().finally(() => {
			setIsSelectingNewThread(false);
		});
		selectThread(thread.id);
	};

	const handleNewChat = async () => {
		await selectOrCreateNewChat();
	};

	const handleSelectThread = (threadId: string) => {
		selectThread(threadId);
	};

	const handleDeleteThread = async (threadId: string) => {
		const remainingThreads = threads.filter((thread) => thread.id !== threadId);

		await deleteThread(threadId);

		if (activeThreadId === threadId) {
			await selectOrCreateNewChat(remainingThreads);
		}
	};

	useEffect(() => {
		if (!selectedThread?.hasUnreadCompletion) {
			return;
		}

		if (markingViewedThreadIdsRef.current.has(selectedThread.id)) {
			return;
		}

		markingViewedThreadIdsRef.current.add(selectedThread.id);
		void markThreadViewed(selectedThread.id).finally(() => {
			markingViewedThreadIdsRef.current.delete(selectedThread.id);
		});
	}, [
		markThreadViewed,
		selectedThread?.hasUnreadCompletion,
		selectedThread?.id,
	]);

	const threadList = threads.map((thread) =>
		thread.lastUserMessageAt === null
			? thread
			: thread.id === activeThreadId
				? { ...thread, hasUnreadCompletion: false }
				: thread,
	);
	const visibleThreadList = threadList.filter(
		(thread) => thread.lastUserMessageAt !== null,
	);

	const isThreadDirectoryLoading = !areThreadsReady;
	const chatContent = isThreadDirectoryLoading ? (
		<AiChatPanelLoadingContent />
	) : activeThreadId ? (
		<Suspense key={activeThreadId} fallback={<AiChatPanelLoadingContent />}>
			<AiChatThreadView
				hasPersistedMessages={Boolean(selectedThread?.lastUserMessageAt)}
				modelId={modelId}
				onModelChange={setModelId}
				threadId={activeThreadId}
			/>
		</Suspense>
	) : isCreatingThread || isSelectingNewThread ? (
		<AiChatPanelLoadingContent />
	) : (
		<AiChatEmptyThreadView
			isSubmitting={isCreatingThread}
			onNewChat={handleNewChat}
		/>
	);

	return (
		<aside className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
			<AiChatPanelToolbar
				activeThreadId={activeThreadId}
				isMaximized={isMaximized}
				onClose={() => closeChatPanel(workspaceId)}
				onDeleteThread={(thread) => {
					setThreadPendingDeletion(thread);
					setIsDeleteThreadDialogOpen(true);
				}}
				isNewChatDisabled={isCreatingThread || isSelectingNewThread}
				onNewChat={handleNewChat}
				onMaximize={() => maximizeChat(workspaceId)}
				onRestore={() => restorePresentation(workspaceId)}
				onSelectThread={handleSelectThread}
				threads={visibleThreadList}
			/>

			{chatContent}

			<DeleteAiChatThreadDialog
				open={isDeleteThreadDialogOpen}
				thread={threadPendingDeletion}
				onClosed={() => setThreadPendingDeletion(undefined)}
				onConfirm={(threadId) => void handleDeleteThread(threadId)}
				onOpenChange={setIsDeleteThreadDialogOpen}
			/>
		</aside>
	);
}

type AiChatThreadForDialog = {
	id: string;
	title: string;
};

function DeleteAiChatThreadDialog({
	onClosed,
	onConfirm,
	onOpenChange,
	open,
	thread,
}: {
	onClosed: () => void;
	onConfirm: (threadId: string) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	thread?: AiChatThreadForDialog;
}) {
	return (
		<AlertDialog
			open={open}
			onOpenChange={onOpenChange}
			onOpenChangeComplete={(nextOpen) => {
				if (!nextOpen) {
					onClosed();
				}
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete chat?</AlertDialogTitle>
					<AlertDialogDescription>
						This cannot be undone.
						{thread ? ` "${thread.title}" will be removed.` : ""}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={() => {
							if (thread) {
								onConfirm(thread.id);
							}

							onOpenChange(false);
						}}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function AiChatThreadView({
	hasPersistedMessages,
	modelId,
	onModelChange,
	threadId,
}: {
	hasPersistedMessages: boolean;
	modelId: AiChatModelId;
	onModelChange: (modelId: AiChatModelId) => void;
	threadId: string;
}) {
	const chat = useWorkspaceAiChat({ modelId, threadId });
	const {
		addToolApprovalResponse,
		error,
		messages,
		regenerate,
		sendMessage: sendChatMessage,
		status,
		stop,
	} = chat;
	const sendMessage = useCallback(
		(message: AiChatPromptMessage) => {
			const chatMessage = getChatMessageFromPrompt(message);

			if (!chatMessage) {
				return false;
			}

			return sendChatMessage(chatMessage);
		},
		[sendChatMessage],
	);

	return (
		<AiChatPanelBody
			isLoadingHistory={hasPersistedMessages && messages.length === 0}
			error={error}
			messages={messages}
			onModelChange={onModelChange}
			onRegenerateLastResponse={regenerate}
			onRetryLastResponse={regenerate}
			onStop={stop}
			onSubmit={sendMessage}
			onToolApprovalResponse={addToolApprovalResponse}
			modelId={modelId}
			status={status}
		/>
	);
}

function AiChatEmptyThreadView({
	isSubmitting,
	onNewChat,
}: {
	isSubmitting: boolean;
	onNewChat: () => Promise<void>;
}) {
	return (
		<Conversation className="min-h-0">
			<ConversationContent
				scrollClassName="min-h-0 overscroll-contain"
				className="px-4 pt-14 pb-5"
			>
				<ConversationEmptyState className="min-h-[min(32rem,calc(100vh-12rem))] border-0 p-6">
					<div className="flex flex-col items-center gap-3 text-center">
						<div className="space-y-1">
							<div className="font-medium text-sm">No chat selected</div>
							<div className="text-muted-foreground text-sm">
								Create a chat to start.
							</div>
						</div>
						<Button
							disabled={isSubmitting}
							onClick={() => void onNewChat()}
							size="sm"
							type="button"
						>
							<Plus className="size-4" aria-hidden="true" />
							New chat
						</Button>
					</div>
				</ConversationEmptyState>
			</ConversationContent>
		</Conversation>
	);
}

function AiChatPanelBody({
	error,
	isLoadingHistory,
	messages,
	modelId,
	onModelChange,
	onRegenerateLastResponse,
	onRetryLastResponse,
	onStop,
	onSubmit,
	onToolApprovalResponse,
	status,
}: {
	error?: Error;
	isLoadingHistory?: boolean;
	messages: AiChatMessage[];
	modelId: AiChatModelId;
	onModelChange: (modelId: AiChatModelId) => void;
	onRegenerateLastResponse?: () => void;
	onRetryLastResponse?: () => void;
	onStop?: () => void;
	onSubmit: ComponentProps<typeof AiChatPromptInput>["onSubmit"];
	onToolApprovalResponse?: ComponentProps<
		typeof AiChatMessageList
	>["onToolApprovalResponse"];
	status: AiChatStatus;
}) {
	return (
		<>
			<Conversation className="min-h-0">
				<ConversationContent
					scrollClassName="min-h-0 overscroll-contain"
					className="gap-5 px-4 pt-14 pb-5"
				>
					<AiChatMessageList
						isLoadingHistory={isLoadingHistory}
						messages={messages}
						status={status}
						onRegenerateLastResponse={onRegenerateLastResponse}
						onToolApprovalResponse={onToolApprovalResponse}
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
								{onRetryLastResponse ? (
									<Button
										type="button"
										variant="outline"
										size="xs"
										className="self-end gap-1.5 border-border bg-background text-foreground hover:bg-muted hover:text-foreground"
										onClick={onRetryLastResponse}
									>
										<RotateCcw className="size-3" />
										Try again
									</Button>
								) : null}
							</div>
						</Alert>
					) : null}
					<AiChatPromptInput
						modelId={modelId}
						status={status}
						onModelChange={onModelChange}
						onSubmit={onSubmit}
						onStop={onStop}
					/>
				</div>
			</div>
		</>
	);
}

function getChatMessageFromPrompt(
	message: AiChatPromptMessage,
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
