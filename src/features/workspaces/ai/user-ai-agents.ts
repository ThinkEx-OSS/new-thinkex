import type { ChatResponseResult } from "@cloudflare/think";
import { Agent, callable } from "agents";
import { nanoid } from "nanoid";

import {
	type AIInspectorSnapshot,
	isAIInspectorEnabled,
} from "#/features/workspaces/ai/ai-inspector";
import { createAIThreadClass } from "#/features/workspaces/ai/ai-thread";
import { assertCanReadWorkspace } from "#/features/workspaces/ai/ai-thread-directory-permissions";
import { ensureChatMetaColumns } from "#/features/workspaces/ai/ai-thread-directory-schema";
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
		this.sql`CREATE TABLE IF NOT EXISTS chat_meta (
			id TEXT PRIMARY KEY,
			workspace_id TEXT NOT NULL,
			title TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'idle',
			last_run_result TEXT,
			last_activity_at INTEGER NOT NULL,
			last_user_message_at INTEGER,
			last_assistant_message_at INTEGER,
			last_viewed_at INTEGER NOT NULL,
			last_run_started_at INTEGER,
			last_run_finished_at INTEGER,
			last_error_message TEXT,
			title_generated_at INTEGER,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			archived_at INTEGER
		)`;
		ensureChatMetaColumns(this);
		this.sql`CREATE INDEX IF NOT EXISTS chat_meta_workspace_activity_idx
			ON chat_meta (workspace_id, archived_at, last_activity_at)`;
		this._refreshState();
	}

	override async onBeforeSubAgent(
		_request: Request,
		{ className, name }: { className: string; name: string },
	): Promise<Request | Response | undefined> {
		if (className !== "AIThread") {
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
	async ensureDraftThread(input: {
		workspaceId: string;
	}): Promise<AIThreadSummary> {
		return this._ensureDraftThread(input);
	}

	private async _ensureDraftThread(input: {
		workspaceId: string;
	}): Promise<AIThreadSummary> {
		const workspaceId = input.workspaceId.trim();

		if (!workspaceId) {
			throw new Error("workspaceId is required");
		}

		await assertCanReadWorkspace({ userId: this.name, workspaceId });

		const existingEmptyThread = this._getEmptyThreadSummary(workspaceId);

		if (existingEmptyThread) {
			return existingEmptyThread;
		}

		const id = nanoid(12);
		const now = Date.now();
		const title = getThreadTitle(now);

		await this.subAgent(AIThread, id);

		try {
			this.sql`
				INSERT INTO chat_meta (
					id,
					workspace_id,
					title,
					status,
					last_run_result,
					last_activity_at,
					last_user_message_at,
					last_assistant_message_at,
					last_viewed_at,
					last_run_started_at,
					last_run_finished_at,
					last_error_message,
					title_generated_at,
					created_at,
					updated_at,
					archived_at
				)
				VALUES (
					${id},
					${workspaceId},
					${title},
					'idle',
					NULL,
					${now},
					NULL,
					NULL,
					${now},
					NULL,
					NULL,
					NULL,
					NULL,
					${now},
					${now},
					NULL
				)
			`;
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

		this.sql`
			UPDATE chat_meta
			SET last_viewed_at = ${now}, updated_at = ${now}
			WHERE id = ${threadId} AND archived_at IS NULL
		`;
		this._refreshState();
	}

	@callable()
	async deleteThread(threadId: string): Promise<void> {
		await this._requireThreadMeta(threadId);
		await this.deleteSubAgent(AIThread, threadId);
		this.sql`DELETE FROM chat_meta WHERE id = ${threadId}`;
		this._refreshState();
	}

	@callable()
	async getThreadInspectorSnapshot(
		threadId: string,
	): Promise<AIInspectorSnapshot> {
		await this._requireThreadMeta(threadId);

		if (!isAIInspectorEnabled()) {
			return { isEnabled: false, threadId, events: [] };
		}

		const thread = await this.subAgent(AIThread, threadId);
		return thread.getInspectorSnapshot();
	}

	async getThreadContext(threadId: string): Promise<AIThreadContext | null> {
		try {
			const thread = await this._requireThreadMeta(threadId);

			return {
				id: thread.id,
				workspaceId: thread.workspace_id,
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

	async recordThreadRunStarted(threadId: string): Promise<void> {
		const now = Date.now();

		this.sql`
			UPDATE chat_meta
			SET
				status = 'running',
				last_run_result = NULL,
				last_activity_at = ${now},
				last_user_message_at = ${now},
				last_run_started_at = ${now},
				last_run_finished_at = NULL,
				last_error_message = NULL,
				updated_at = ${now}
			WHERE id = ${threadId} AND archived_at IS NULL
		`;
		this._refreshState();
	}

	async recordThreadRunFinished(
		threadId: string,
		result: ChatResponseResult,
		options: { viewed: boolean },
	): Promise<void> {
		const now = Date.now();
		const thread = await this._requireThreadMeta(threadId);

		this.sql`
			UPDATE chat_meta
			SET
				status = 'idle',
				last_run_result = ${result.status},
				last_activity_at = ${now},
				last_assistant_message_at = ${
					result.status === "completed" ? now : thread.last_assistant_message_at
				},
				last_viewed_at = ${options.viewed ? now : thread.last_viewed_at},
				last_run_finished_at = ${now},
				last_error_message = NULL,
				updated_at = ${now}
			WHERE id = ${threadId} AND archived_at IS NULL
		`;
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

		this.sql`
			UPDATE chat_meta
			SET title = ${title}, title_generated_at = ${now}, updated_at = ${now}
			WHERE id = ${threadId}
				AND archived_at IS NULL
				AND title_generated_at IS NULL
		`;
		this._refreshState();
	}

	async recordThreadRunFailed(
		threadId: string,
		error: unknown = undefined,
	): Promise<void> {
		const now = Date.now();
		const errorMessage = normalizeThreadErrorMessage(error);

		this.sql`
			UPDATE chat_meta
			SET
				status = 'idle',
				last_run_result = 'error',
				last_activity_at = ${now},
				last_run_finished_at = ${now},
				last_error_message = ${errorMessage},
				updated_at = ${now}
			WHERE id = ${threadId} AND archived_at IS NULL
		`;
		this._refreshState();
	}

	private _refreshState() {
		const registry = this.listSubAgents(AIThread);
		const threadIds = new Set(registry.map((entry) => entry.name));

		const threads = this._getActiveThreadMetaRows()
			.filter((row) => threadIds.has(row.id))
			.map(mapThreadMetaRow)
			.sort(compareThreadRecentFirst);

		this.setState({ ...this.state, isLoaded: true, threads });
	}

	private _getThreadMeta(threadId: string) {
		return (
			this._getActiveThreadMetaRows().find((row) => row.id === threadId) ?? null
		);
	}

	private _getActiveThreadMetaRows() {
		return this.sql<AIThreadMetaRow>`
			SELECT
				id,
				workspace_id,
				title,
				status,
				last_run_result,
				last_activity_at,
				last_user_message_at,
				last_assistant_message_at,
				last_viewed_at,
				last_run_started_at,
				last_run_finished_at,
				last_error_message,
				title_generated_at,
				created_at,
				updated_at,
				archived_at
			FROM chat_meta
			WHERE archived_at IS NULL
		`;
	}

	private _getThreadSummary(threadId: string) {
		const thread = this._getThreadMeta(threadId);

		return thread ? mapThreadMetaRow(thread) : null;
	}

	private _getEmptyThreadSummary(workspaceId: string) {
		const registry = this.listSubAgents(AIThread);
		const threadIds = new Set(registry.map((entry) => entry.name));
		const thread = this._getActiveThreadMetaRows()
			.filter(
				(row) =>
					row.workspace_id === workspaceId && row.last_user_message_at === null,
			)
			.sort((left, right) => right.created_at - left.created_at)
			.find((row) => threadIds.has(row.id));

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
			await assertCanReadWorkspace({
				userId: this.name,
				workspaceId: thread.workspace_id,
			});
		} catch {
			throw new AIThreadForbiddenError();
		}

		return thread;
	}
}
