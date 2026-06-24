import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AiChatModelId } from "#/features/workspaces/components/ai-chat/types";
import { useWorkspaceAiChatThreads } from "#/features/workspaces/components/ai-chat/useWorkspaceAiChatThreads";
import {
	useWorkspaceActiveAiChatThreadId,
	useWorkspaceAiChatModelId,
	useWorkspaceAiChatSurfaceMode,
	useWorkspaceUiStore,
} from "#/features/workspaces/state/workspace-ui-store";
import { getErrorMessage } from "#/lib/error-message";

type UseAiChatPanelControllerInput = {
	workspaceId: string;
};

type AiChatThreadForDialog = {
	id: string;
	title: string;
};

export function useAiChatPanelController({ workspaceId }: UseAiChatPanelControllerInput) {
	const chatSurfaceMode = useWorkspaceAiChatSurfaceMode(workspaceId);
	const activeThreadId = useWorkspaceActiveAiChatThreadId(workspaceId);
	const modelId = useWorkspaceAiChatModelId(workspaceId);
	const setChatSurfaceMode = useWorkspaceUiStore((state) => state.setChatSurfaceMode);
	const setActiveAiChatThread = useWorkspaceUiStore((state) => state.setActiveAiChatThread);
	const setAiChatModel = useWorkspaceUiStore((state) => state.setAiChatModel);
	const [isDeleteThreadDialogOpen, setIsDeleteThreadDialogOpen] = useState(false);
	const [threadPendingDeletion, setThreadPendingDeletion] = useState<AiChatThreadForDialog>();
	const [markingViewedThreadIds] = useState(() => new Set<string>());
	const {
		createThread,
		deleteThread,
		getThreadInspectorSnapshot,
		isCreatingThread,
		isReady: areThreadsReady,
		markThreadViewed,
		threads,
	} = useWorkspaceAiChatThreads({ workspaceId });
	const activeThread = threads.find((thread) => thread.id === activeThreadId);
	const isMaximized = chatSurfaceMode === "fullscreen";

	const selectThread = (threadId: string | undefined) => {
		setActiveAiChatThread(workspaceId, threadId);
	};

	const handleNewChat = async () => {
		if (isCreatingThread) {
			return;
		}

		try {
			const thread = await createThread();
			selectThread(thread.id);
		} catch (error) {
			console.warn("[AiChatPanel] Failed to create chat thread", error);
		}
	};

	const handleDeleteThread = async (threadId: string) => {
		const remainingThreads = threads.filter((thread) => thread.id !== threadId);

		try {
			await deleteThread(threadId);
			toast.success("Chat deleted.");
		} catch (error) {
			toast.error(getErrorMessage(error, "Unable to delete chat right now."));
			return;
		}

		if (activeThreadId !== threadId) {
			return;
		}

		selectThread(remainingThreads[0]?.id);
	};

	useEffect(() => {
		if (!areThreadsReady) {
			return;
		}

		if (threads.length === 0) {
			if (activeThreadId) {
				setActiveAiChatThread(workspaceId, undefined);
			}
			return;
		}

		if (!activeThreadId || !threads.some((thread) => thread.id === activeThreadId)) {
			setActiveAiChatThread(workspaceId, threads[0].id);
		}
	}, [activeThreadId, areThreadsReady, setActiveAiChatThread, threads, workspaceId]);

	useEffect(() => {
		if (!activeThread?.hasUnreadUpdate) {
			return;
		}

		if (markingViewedThreadIds.has(activeThread.id)) {
			return;
		}

		markingViewedThreadIds.add(activeThread.id);
		void markThreadViewed(activeThread.id).finally(() => {
			markingViewedThreadIds.delete(activeThread.id);
		});
	}, [activeThread?.hasUnreadUpdate, activeThread?.id, markingViewedThreadIds, markThreadViewed]);

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
		isCreatingThread,
		isMaximized,
		modelId,
		onClose: () => setChatSurfaceMode(workspaceId, "hidden"),
		onDeleteThread: (thread: AiChatThreadForDialog) => {
			setThreadPendingDeletion(thread);
			setIsDeleteThreadDialogOpen(true);
		},
		onMaximize: () => setChatSurfaceMode(workspaceId, "fullscreen"),
		onModelChange: (nextModelId: AiChatModelId) => setAiChatModel(workspaceId, nextModelId),
		onNewChat: () => void handleNewChat(),
		onRestore: () => setChatSurfaceMode(workspaceId, "docked"),
		onSelectThread: (threadId: string) => selectThread(threadId),
		threads: threads.map((thread) =>
			thread.id === activeThreadId ? { ...thread, hasUnreadUpdate: false } : thread,
		),
	};
}
