import { useAgent } from "agents/react";
import { useCallback, useMemo, useState } from "react";

import {
	userAIAgentName,
	userAIBasePath,
} from "#/features/workspaces/agent-routes";
import type { AIInspectorSnapshot } from "#/features/workspaces/ai/ai-inspector";
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
	const [isEnsuringDraftThread, setIsEnsuringDraftThread] = useState(false);
	const directory = useAgent<UserAIStoreState>({
		agent: userAIAgentName,
		basePath: userAIBasePath,
	});

	const threads = useMemo(
		() =>
			(directory.state?.threads ?? []).filter(
				(thread) => thread.workspaceId === workspaceId,
			),
		[directory.state?.threads, workspaceId],
	);

	const ensureDraftThread = useCallback(async () => {
		setIsEnsuringDraftThread(true);

		try {
			return await directory.call<AIThreadSummary>("ensureDraftThread", [
				{ workspaceId },
			]);
		} finally {
			setIsEnsuringDraftThread(false);
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

	const getThreadInspectorSnapshot = useCallback(
		async (threadId: string): Promise<AIInspectorSnapshot> => {
			return await directory.call<AIInspectorSnapshot>(
				"getThreadInspectorSnapshot",
				[threadId],
			);
		},
		[directory],
	);

	return {
		deleteThread,
		directory,
		getThreadInspectorSnapshot: import.meta.env.DEV
			? getThreadInspectorSnapshot
			: undefined,
		isEnsuringDraftThread,
		isReady: directory.state?.isLoaded === true,
		ensureDraftThread,
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

export function getWorkspaceAiChatThreadSelection(input: {
	activeThreadId?: string;
	isReady: boolean;
	selectedDraftThreadId?: string;
	threads: AIThreadSummary[];
}) {
	const draftThread = getDraftThread(input.threads);
	const realThreads = getRealThreads(input.threads);
	const activeThread = findWorkspaceAiChatThread(
		input.threads,
		input.activeThreadId,
	);
	const selectedDraftThread = findWorkspaceAiChatThread(
		input.threads,
		input.selectedDraftThreadId,
	);
	const activeRealThread =
		activeThread && !isDraftThread(activeThread) ? activeThread : undefined;
	const selectedThread = input.isReady
		? (selectedDraftThread ?? activeRealThread ?? realThreads[0] ?? draftThread)
		: undefined;

	return {
		draftThread,
		realThreads,
		selectedThread,
	};
}

export function isDraftThread(thread: AIThreadSummary) {
	return thread.lastUserMessageAt === null;
}

export function getDraftThread(threads: AIThreadSummary[]) {
	return threads.find(isDraftThread);
}

export function getRealThreads(threads: AIThreadSummary[]) {
	return threads.filter((thread) => !isDraftThread(thread));
}
