import type { ChatResponseResult } from "@cloudflare/think";
import { Agent, callable } from "agents";
import { nanoid } from "nanoid";

import { aiThreadAgentName } from "#/features/workspaces/agent-routes";
import {
	type AIInspectorSnapshot,
	isAIInspectorEnabled,
} from "#/features/workspaces/ai/ai-inspector";
import { createAIThreadClass } from "#/features/workspaces/ai/ai-thread";
import {
	deleteThreadMeta,
	ensureChatMetaStore,
	getActiveThreadMetaRows,
	insertThreadMeta,
	markGeneratedThreadTitle,
	markThreadMetaViewed,
	markThreadRunFailed,
	markThreadRunFinished,
	markThreadRunStarted,
} from "#/features/workspaces/ai/ai-thread-directory-store";
import {
	type AIThreadContext,
	type AIThreadMetaRow,
	type AIThreadSummary,
	compareThreadRecentFirst,
	getThreadTitle,
	mapThreadMetaRow,
	normalizeGeneratedThreadTitle,
	normalizeThreadErrorMessage,
	type UserAIStoreState,
} from "#/features/workspaces/ai/ai-thread-metadata";
import { getReadableWorkspacePromptScope } from "#/features/workspaces/ai/ai-thread-prompt-scope";

export type {
	AIThreadSummary,
	UserAIStoreState,
} from "#/features/workspaces/ai/ai-thread-metadata";

class AIThreadNotFoundError extends Error {
	constructor() {
		super("Chat thread not found");
	}
}

class AIThreadForbiddenError extends Error {
	constructor() {
		super("Forbidden");
	}
}

export const AIThread = createAIThreadClass(() => UserAIStore);

export class UserAIStore extends Agent<Env, UserAIStoreState> {
	static options = { sendIdentityOnConnect: false };

	initialState: UserAIStoreState = { isLoaded: false, threads: [] };

	onStart() {
		ensureChatMetaStore(this);
		this._refreshState();
	}

	override async onBeforeSubAgent(
		_request: Request,
		{ className, name }: { className: string; name: string },
	): Promise<Request | Response | undefined> {
		if (className !== aiThreadAgentName) {
			return new Response("Chat thread not found", { status: 404 });
		}

		try {
			await this._requireThreadMeta(name);
		} catch (error) {
			if (error instanceof AIThreadForbiddenError) {
				return new Response("Forbidden", { status: 403 });
			}

			return new Response("Chat thread not found", { status: 404 });
		}
	}

	@callable()
	async createThread(input: { workspaceId: string }): Promise<AIThreadSummary> {
		return this._createThread(input);
	}

	private async _createThread(input: {
		workspaceId: string;
	}): Promise<AIThreadSummary> {
		const workspaceId = input.workspaceId.trim();

		if (!workspaceId) {
			throw new Error("workspaceId is required");
		}

		await getReadableWorkspacePromptScope({
			userId: this.name,
			workspaceId,
		});

		const id = nanoid(12);
		const now = Date.now();
		const title = getThreadTitle();

		await this.subAgent(AIThread, id);

		try {
			insertThreadMeta(this, {
				id,
				workspaceId,
				title,
				now,
			});
		} catch (error) {
			await this.deleteSubAgent(AIThread, id);
			throw error;
		}

		this._refreshState();
		const created = this._getThreadSummary(id);

		if (!created) {
			throw new Error("Failed to create chat thread");
		}

		return created;
	}

	@callable()
	async markThreadViewed(threadId: string): Promise<void> {
		await this._requireThreadMeta(threadId);

		const now = Date.now();

		markThreadMetaViewed(this, threadId, now);
		this._refreshState();
	}

	@callable()
	async deleteThread(threadId: string): Promise<void> {
		await this._requireThreadMeta(threadId);
		await this.deleteSubAgent(AIThread, threadId);
		deleteThreadMeta(this, threadId);
		this._refreshState();
	}

	@callable()
	async getThreadInspectorSnapshot(
		threadId: string,
	): Promise<AIInspectorSnapshot> {
		if (!isAIInspectorEnabled()) {
			return { isEnabled: false, threadId, events: [] };
		}

		await this._requireThreadMeta(threadId);

		const thread = await this.subAgent(AIThread, threadId);
		return thread.getInspectorSnapshot();
	}

	async getThreadContext(threadId: string): Promise<AIThreadContext | null> {
		try {
			const thread = await this._requireThreadMeta(threadId);
			const promptScope = await getReadableWorkspacePromptScope({
				workspaceId: thread.workspace_id,
				userId: this.name,
			});

			return {
				id: thread.id,
				workspaceId: thread.workspace_id,
				promptScope,
				userId: this.name,
			};
		} catch {
			return null;
		}
	}

	async shouldGenerateThreadTitle(threadId: string): Promise<boolean> {
		const thread = await this._requireThreadMeta(threadId);
		return thread.title_generated_at === null;
	}

	async recordThreadRunStarted(
		threadId: string,
		input: { isUserMessage: boolean },
	): Promise<number> {
		const now = Date.now();

		markThreadRunStarted(this, {
			threadId,
			now,
			isUserMessage: input.isUserMessage,
		});
		this._refreshState();
		return now;
	}

	async recordThreadRunFinished(
		threadId: string,
		result: ChatResponseResult,
		options: { startedAt: number; viewed: boolean; errorMessage?: string },
	): Promise<void> {
		const now = Date.now();
		const thread = await this._requireThreadMeta(threadId);

		markThreadRunFinished(this, {
			threadId,
			result: result.status,
			now,
			startedAt: options.startedAt,
			lastAssistantMessageAt:
				result.status === "completed" ? now : thread.last_assistant_message_at,
			lastViewedAt: options.viewed ? now : thread.last_viewed_at,
			errorMessage:
				result.status === "error"
					? normalizeThreadErrorMessage(options.errorMessage)
					: null,
		});
		this._refreshState();
	}

	async recordGeneratedThreadTitle(
		threadId: string,
		generatedTitle: string | undefined,
	): Promise<void> {
		const title = normalizeGeneratedThreadTitle(generatedTitle);

		if (!title) {
			return;
		}

		await this._requireThreadMeta(threadId);

		const now = Date.now();

		markGeneratedThreadTitle(this, threadId, title, now);
		this._refreshState();
	}

	async recordThreadRunFailed(
		threadId: string,
		error: unknown = undefined,
		options: { startedAt?: number } = {},
	): Promise<void> {
		const now = Date.now();
		const errorMessage = normalizeThreadErrorMessage(error);

		markThreadRunFailed(this, {
			threadId,
			errorMessage,
			now,
			startedAt: options.startedAt,
		});
		this._refreshState();
	}

	private _refreshState() {
		const registry = this.listSubAgents(AIThread);
		const threadIds = new Set(registry.map((entry) => entry.name));
		const threads: AIThreadSummary[] = [];

		for (const row of this._getActiveThreadMetaRows()) {
			if (threadIds.has(row.id)) {
				threads.push(mapThreadMetaRow(row));
			}
		}

		threads.sort(compareThreadRecentFirst);

		this.setState({ ...this.state, isLoaded: true, threads });
	}

	private _getThreadMeta(threadId: string) {
		return (
			this._getActiveThreadMetaRows().find((row) => row.id === threadId) ?? null
		);
	}

	private _getActiveThreadMetaRows() {
		return getActiveThreadMetaRows(this);
	}

	private _getThreadSummary(threadId: string) {
		const thread = this._getThreadMeta(threadId);

		return thread ? mapThreadMetaRow(thread) : null;
	}

	private async _requireThreadMeta(threadId: string): Promise<AIThreadMetaRow> {
		if (!this.hasSubAgent(AIThread, threadId)) {
			throw new AIThreadNotFoundError();
		}

		const thread = this._getThreadMeta(threadId);

		if (!thread || thread.archived_at !== null) {
			throw new AIThreadNotFoundError();
		}

		try {
			await getReadableWorkspacePromptScope({
				userId: this.name,
				workspaceId: thread.workspace_id,
			});
		} catch {
			throw new AIThreadForbiddenError();
		}

		return thread;
	}
}
