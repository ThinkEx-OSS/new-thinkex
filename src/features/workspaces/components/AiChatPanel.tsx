import { Suspense, useEffect, useRef, useState } from "react";
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
import type { AIThreadSummary } from "#/features/workspaces/ai/user-ai-agents";
import AiChatPanelToolbar from "#/features/workspaces/components/ai-chat/AiChatPanelToolbar";
import { AiChatPanelLoadingContent } from "#/features/workspaces/components/ai-chat/AiChatThreadSkeleton";
import AiChatThreadView from "#/features/workspaces/components/ai-chat/AiChatThreadView";
import { DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID } from "#/features/workspaces/components/ai-chat/constants";
import type { AiChatModelId } from "#/features/workspaces/components/ai-chat/types";
import {
	findWorkspaceAiChatThread,
	useWorkspaceAiChatThreads,
} from "#/features/workspaces/components/ai-chat/useWorkspaceAiChatThreads";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";

interface AiChatPanelProps {
	workspaceId: string;
}

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
	const [selectedDraftThreadId, setSelectedDraftThreadId] = useState<string>();
	const [threadPendingDeletion, setThreadPendingDeletion] =
		useState<AiChatThreadForDialog>();
	const markingViewedThreadIdsRef = useRef<Set<string>>(new Set());
	const {
		deleteThread,
		ensureDraftThread,
		isEnsuringDraftThread,
		isReady: areThreadsReady,
		markThreadViewed,
		threads,
	} = useWorkspaceAiChatThreads({ workspaceId });
	const activeThread = findWorkspaceAiChatThread(
		threads,
		activeThreadIdFromStore,
	);
	const draftThread = getDraftThread(threads);
	const selectedDraftThread = findWorkspaceAiChatThread(
		threads,
		selectedDraftThreadId,
	);
	const realThreads = getRealThreads(threads);
	const activeRealThread =
		activeThread && !isDraftThread(activeThread) ? activeThread : undefined;
	const selectedThread = areThreadsReady
		? (selectedDraftThread ?? activeRealThread ?? realThreads[0] ?? draftThread)
		: undefined;
	const activeThreadId = selectedThread?.id;

	const selectThread = (threadId: string | undefined) => {
		setActiveAiChatThread(workspaceId, threadId);
	};

	const selectDraftThread = async (
		candidateThread: AIThreadSummary | undefined,
	) => {
		if (candidateThread) {
			setSelectedDraftThreadId(candidateThread.id);
			return;
		}

		if (isEnsuringDraftThread) {
			return;
		}

		const thread = await ensureDraftThread();
		setSelectedDraftThreadId(thread.id);
	};

	const handleNewChat = async () => {
		await selectDraftThread(draftThread);
	};

	const handleSelectThread = (threadId: string) => {
		setSelectedDraftThreadId(undefined);
		selectThread(threadId);
	};

	const handleDeleteThread = async (threadId: string) => {
		const remainingThreads = threads.filter((thread) => thread.id !== threadId);

		await deleteThread(threadId);

		if (activeThreadId === threadId) {
			const remainingRealThread = getRealThreads(remainingThreads)[0];

			if (remainingRealThread) {
				setSelectedDraftThreadId(undefined);
				selectThread(remainingRealThread.id);
				return;
			}

			await selectDraftThread(getDraftThread(remainingThreads));
		}
	};

	useEffect(() => {
		if (!areThreadsReady || draftThread || isEnsuringDraftThread) {
			return;
		}

		void ensureDraftThread().catch((error) => {
			console.warn("[AiChatPanel] Failed to ensure draft chat thread", error);
		});
	}, [areThreadsReady, draftThread, ensureDraftThread, isEnsuringDraftThread]);

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

	const visibleThreadList = realThreads.map((thread) =>
		thread.id === activeThreadId
			? { ...thread, hasUnreadCompletion: false }
			: thread,
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
				onThreadActivated={
					selectedThread && isDraftThread(selectedThread)
						? () => selectThread(selectedThread.id)
						: undefined
				}
				threadId={activeThreadId}
			/>
		</Suspense>
	) : (
		<AiChatPanelLoadingContent />
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
				isNewChatDisabled={isEnsuringDraftThread}
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

function isDraftThread(thread: AIThreadSummary) {
	return thread.lastUserMessageAt === null;
}

function getDraftThread(threads: AIThreadSummary[]) {
	return threads.find(isDraftThread);
}

function getRealThreads(threads: AIThreadSummary[]) {
	return threads.filter((thread) => !isDraftThread(thread));
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
