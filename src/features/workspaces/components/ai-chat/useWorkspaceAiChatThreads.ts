import { useAgent } from "agents/react";
import { useCallback, useMemo, useState } from "react";

import type {
	WorkspaceChatDirectoryState,
	WorkspaceChatThreadSummary,
} from "#/features/workspaces/ai/workspace-chat-agent";

interface UseWorkspaceAiChatThreadsOptions {
	workspaceId: string;
}

export function useWorkspaceAiChatThreads({
	workspaceId,
}: UseWorkspaceAiChatThreadsOptions) {
	const [isCreatingThread, setIsCreatingThread] = useState(false);
	const directory = useAgent<WorkspaceChatDirectoryState>({
		agent: "WorkspaceChatDirectory",
		basePath: "workspace-chat",
	});

	const threads = useMemo(
		() =>
			(directory.state?.threads ?? []).filter(
				(thread) => thread.workspaceId === workspaceId,
			),
		[directory.state?.threads, workspaceId],
	);

	const createThread = useCallback(async () => {
		setIsCreatingThread(true);

		try {
			return await directory.call<WorkspaceChatThreadSummary>("createThread", [
				{ workspaceId },
			]);
		} finally {
			setIsCreatingThread(false);
		}
	}, [directory, workspaceId]);

	const deleteThread = useCallback(
		async (threadId: string) => {
			await directory.call("deleteThread", [threadId]);
		},
		[directory],
	);

	const markThreadViewed = useCallback(
		async (threadId: string) => {
			await directory.call("markThreadViewed", [threadId]);
		},
		[directory],
	);

	return {
		createThread,
		deleteThread,
		directory,
		isCreatingThread,
		isReady: directory.state?.isLoaded === true,
		markThreadViewed,
		threads,
	};
}

export function findWorkspaceAiChatThread(
	threads: WorkspaceChatThreadSummary[],
	threadId: string | undefined,
) {
	if (!threadId) {
		return undefined;
	}

	return threads.find((thread) => thread.id === threadId);
}
