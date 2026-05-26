import { useAgent } from "agents/react";
import { useCallback, useMemo, useState } from "react";

import type {
	AIThreadSummary,
	UserAIStoreState,
} from "#/features/workspaces/ai/user-ai-agents";

interface UseWorkspaceAiChatThreadsOptions {
	workspaceId: string;
}

export function useWorkspaceAiChatThreads({
	workspaceId,
}: UseWorkspaceAiChatThreadsOptions) {
	const [isCreatingThread, setIsCreatingThread] = useState(false);
	const directory = useAgent<UserAIStoreState>({
		agent: "UserAIStore",
		basePath: "user-ai",
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
			return await directory.call<AIThreadSummary>("createThread", [
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
	threads: AIThreadSummary[],
	threadId: string | undefined,
) {
	if (!threadId) {
		return undefined;
	}

	return threads.find((thread) => thread.id === threadId);
}
