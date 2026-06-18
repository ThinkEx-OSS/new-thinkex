export type AiChatPanelBodyPhase =
	| { kind: "empty" }
	| { kind: "loading" }
	| { kind: "thread"; threadId: string };

export function getAiChatPanelBodyPhase(input: {
	activeThreadId?: string;
	areThreadsReady: boolean;
	threadCount: number;
}): AiChatPanelBodyPhase {
	if (!input.areThreadsReady) {
		return { kind: "loading" };
	}

	if (input.threadCount === 0) {
		return { kind: "empty" };
	}

	if (!input.activeThreadId) {
		return { kind: "loading" };
	}

	return { kind: "thread", threadId: input.activeThreadId };
}
