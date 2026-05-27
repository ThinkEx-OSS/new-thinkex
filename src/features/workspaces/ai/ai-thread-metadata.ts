export type AIThreadRunState = "idle" | "running";

export interface AIThreadSummary {
	id: string;
	workspaceId: string;
	title: string;
	hasUnreadCompletion: boolean;
	isRunning: boolean;
	lastActivityAt: string;
	lastUserMessageAt: string | null;
	lastAssistantMessageAt: string | null;
	lastViewedAt: string;
	createdAt: string;
	updatedAt: string;
}

export interface UserAIStoreState {
	isLoaded: boolean;
	threads: AIThreadSummary[];
}

export interface AIThreadContext {
	id: string;
	workspaceId: string;
	userId: string;
}

export interface AIThreadMetaRow {
	id: string;
	workspace_id: string;
	title: string;
	status: AIThreadRunState;
	last_activity_at: number;
	last_user_message_at: number | null;
	last_assistant_message_at: number | null;
	last_viewed_at: number;
	title_generated_at: number | null;
	created_at: number;
	updated_at: number;
	archived_at: number | null;
}

export function getThreadTitle(now: number) {
	return `Chat ${new Date(now).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	})}`;
}

export function normalizeGeneratedThreadTitle(value: string | undefined) {
	const title = value
		?.replace(/^["'`]+|["'`.]+$/g, "")
		.replace(/\s+/g, " ")
		.trim();

	if (!title) {
		return null;
	}

	return title.length > 64 ? `${title.slice(0, 61).trimEnd()}...` : title;
}

export function mapThreadMetaRow(row: AIThreadMetaRow): AIThreadSummary {
	return {
		id: row.id,
		workspaceId: row.workspace_id,
		title: row.title,
		hasUnreadCompletion: Boolean(
			row.last_assistant_message_at &&
				row.last_assistant_message_at > row.last_viewed_at,
		),
		isRunning: row.status === "running",
		lastActivityAt: toIsoString(row.last_activity_at),
		lastUserMessageAt: toNullableIsoString(row.last_user_message_at),
		lastAssistantMessageAt: toNullableIsoString(row.last_assistant_message_at),
		lastViewedAt: toIsoString(row.last_viewed_at),
		createdAt: toIsoString(row.created_at),
		updatedAt: toIsoString(row.updated_at),
	};
}

export function compareThreadRecentFirst(
	left: AIThreadSummary,
	right: AIThreadSummary,
) {
	return (
		right.lastActivityAt.localeCompare(left.lastActivityAt) ||
		right.createdAt.localeCompare(left.createdAt)
	);
}

function toNullableIsoString(value: number | null) {
	return value === null ? null : toIsoString(value);
}

function toIsoString(value: number) {
	return new Date(value).toISOString();
}
