import { useEffect, useRef, useState } from "react";
import type { AIThreadSummary } from "#/features/workspaces/ai/user-ai-agents";
import { DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID } from "#/features/workspaces/components/ai-chat/constants";
import type { AiChatModelId } from "#/features/workspaces/components/ai-chat/types";
import {
	getDraftThread,
	getRealThreads,
	getWorkspaceAiChatThreadSelection,
	isDraftThread,
	useWorkspaceAiChatThreads,
} from "#/features/workspaces/components/ai-chat/useWorkspaceAiChatThreads";
import {
	selectWorkspaceActiveAiChatThreadId,
	selectWorkspacePresentation,
	useWorkspaceUiStore,
} from "#/features/workspaces/state/workspace-ui-store";

type UseAiChatPanelControllerInput = {
	workspaceId: string;
};

type AiChatThreadForDialog = {
	id: string;
	title: string;
};

export function useAiChatPanelController({
	workspaceId,
}: UseAiChatPanelControllerInput) {
	const presentation = useWorkspaceUiStore(
		selectWorkspacePresentation(workspaceId),
	);
	const activeThreadIdFromStore = useWorkspaceUiStore(
		selectWorkspaceActiveAiChatThreadId(workspaceId),
	);
	const closeChatPanel = useWorkspaceUiStore((state) => state.closeChatPanel);
	const maximizeChat = useWorkspaceUiStore((state) => state.maximizeChat);
	const restorePresentation = useWorkspaceUiStore(
		(state) => state.restorePresentation,
	);
	const setActiveAiChatThread = useWorkspaceUiStore(
		(state) => state.setActiveAiChatThread,
	);
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
		getThreadInspectorSnapshot,
		isEnsuringDraftThread,
		isReady: areThreadsReady,
		markThreadViewed,
		threads,
	} = useWorkspaceAiChatThreads({ workspaceId });
	const { draftThread, realThreads, selectedThread } =
		getWorkspaceAiChatThreadSelection({
			activeThreadId: activeThreadIdFromStore,
			isReady: areThreadsReady,
			selectedDraftThreadId,
			threads,
		});
	const activeThreadId = selectedThread?.id;
	const isMaximized =
		presentation.mode === "maximized" && presentation.pane.kind === "chat";

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

	return {
		activeThreadId,
		areThreadsReady,
		deleteThreadDialog: {
			onClosed: () => setThreadPendingDeletion(undefined),
			onConfirm: (threadId: string) => void handleDeleteThread(threadId),
			onOpenChange: setIsDeleteThreadDialogOpen,
			open: isDeleteThreadDialogOpen,
			thread: threadPendingDeletion,
		},
		getThreadInspectorSnapshot,
		isEnsuringDraftThread,
		isMaximized,
		modelId,
		onClose: () => closeChatPanel(workspaceId),
		onDeleteThread: (thread: AiChatThreadForDialog) => {
			setThreadPendingDeletion(thread);
			setIsDeleteThreadDialogOpen(true);
		},
		onMaximize: () => maximizeChat(workspaceId),
		onModelChange: setModelId,
		onNewChat: () => void selectDraftThread(draftThread),
		onRestore: () => restorePresentation(workspaceId),
		onSelectThread: (threadId: string) => {
			setSelectedDraftThreadId(undefined);
			selectThread(threadId);
		},
		onThreadActivated:
			selectedThread && isDraftThread(selectedThread)
				? () => selectThread(selectedThread.id)
				: undefined,
		selectedThread,
		visibleThreadList: realThreads.map((thread) =>
			thread.id === activeThreadId
				? { ...thread, hasUnreadCompletion: false }
				: thread,
		),
	};
}
