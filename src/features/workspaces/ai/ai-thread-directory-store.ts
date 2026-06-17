import { ensureChatMetaColumns } from "#/features/workspaces/ai/ai-thread-directory-schema";
import type {
	AIThreadMetaRow,
	AIThreadRunResult,
} from "#/features/workspaces/ai/ai-thread-metadata";

type SqlQuery = <T = unknown>(
	strings: TemplateStringsArray,
	...values: (string | number | boolean | null)[]
) => T[];

interface ChatMetaStore {
	sql: SqlQuery;
}

interface InsertThreadMetaInput {
	id: string;
	workspaceId: string;
	title: string;
	now: number;
}

interface FinishThreadRunInput {
	threadId: string;
	result: AIThreadRunResult;
	now: number;
	startedAt: number;
	lastAssistantMessageAt: number | null;
	lastViewedAt: number;
}

export function ensureChatMetaStore(store: ChatMetaStore) {
	store.sql`CREATE TABLE IF NOT EXISTS chat_meta (
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
	ensureChatMetaColumns(store);
	store.sql`CREATE INDEX IF NOT EXISTS chat_meta_workspace_activity_idx
		ON chat_meta (workspace_id, archived_at, last_activity_at)`;
}

export function insertThreadMeta(
	store: ChatMetaStore,
	input: InsertThreadMetaInput,
) {
	store.sql`
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
			${input.id},
			${input.workspaceId},
			${input.title},
			'idle',
			NULL,
			${input.now},
			NULL,
			NULL,
			${input.now},
			NULL,
			NULL,
			NULL,
			NULL,
			${input.now},
			${input.now},
			NULL
		)
	`;
}

export function markThreadMetaViewed(
	store: ChatMetaStore,
	threadId: string,
	now: number,
) {
	store.sql`
		UPDATE chat_meta
		SET last_viewed_at = ${now}, updated_at = ${now}
		WHERE id = ${threadId} AND archived_at IS NULL
	`;
}

export function deleteThreadMeta(store: ChatMetaStore, threadId: string) {
	store.sql`DELETE FROM chat_meta WHERE id = ${threadId}`;
}

export function markThreadRunStarted(
	store: ChatMetaStore,
	input: {
		threadId: string;
		now: number;
		isUserMessage: boolean;
	},
) {
	store.sql`
		UPDATE chat_meta
		SET
			status = 'running',
			last_run_result = NULL,
			last_activity_at = ${input.now},
			last_user_message_at = CASE
				WHEN ${input.isUserMessage} THEN ${input.now}
				ELSE last_user_message_at
			END,
			last_run_started_at = ${input.now},
			last_run_finished_at = NULL,
			last_error_message = NULL,
			updated_at = ${input.now}
		WHERE id = ${input.threadId} AND archived_at IS NULL
	`;
}

export function markThreadRunFinished(
	store: ChatMetaStore,
	input: FinishThreadRunInput,
) {
	store.sql`
		UPDATE chat_meta
		SET
			status = 'idle',
			last_run_result = ${input.result},
			last_activity_at = ${input.now},
			last_assistant_message_at = ${input.lastAssistantMessageAt},
			last_viewed_at = ${input.lastViewedAt},
			last_run_finished_at = ${input.now},
			last_error_message = NULL,
			updated_at = ${input.now}
		WHERE id = ${input.threadId}
			AND archived_at IS NULL
			AND last_run_started_at = ${input.startedAt}
	`;
}

export function markGeneratedThreadTitle(
	store: ChatMetaStore,
	threadId: string,
	title: string,
	now: number,
) {
	store.sql`
		UPDATE chat_meta
		SET title = ${title}, title_generated_at = ${now}, updated_at = ${now}
		WHERE id = ${threadId}
			AND archived_at IS NULL
			AND title_generated_at IS NULL
	`;
}

export function markThreadRunFailed(
	store: ChatMetaStore,
	input: {
		threadId: string;
		errorMessage: string;
		now: number;
		startedAt?: number;
	},
) {
	if (input.startedAt === undefined) {
		store.sql`
			UPDATE chat_meta
			SET
				status = 'idle',
				last_run_result = 'error',
				last_activity_at = ${input.now},
				last_run_finished_at = ${input.now},
				last_error_message = ${input.errorMessage},
				updated_at = ${input.now}
			WHERE id = ${input.threadId} AND archived_at IS NULL
		`;
		return;
	}

	store.sql`
		UPDATE chat_meta
		SET
			status = 'idle',
			last_run_result = 'error',
			last_activity_at = ${input.now},
			last_run_finished_at = ${input.now},
			last_error_message = ${input.errorMessage},
			updated_at = ${input.now}
		WHERE id = ${input.threadId}
			AND archived_at IS NULL
			AND last_run_started_at = ${input.startedAt}
	`;
}

export function getActiveThreadMetaRows(store: ChatMetaStore) {
	return store.sql<AIThreadMetaRow>`
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
