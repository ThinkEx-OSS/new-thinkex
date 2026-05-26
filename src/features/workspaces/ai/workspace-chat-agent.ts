import type {
	ChatResponseResult,
	TurnConfig,
	TurnContext,
} from "@cloudflare/think";
import { Think } from "@cloudflare/think";
import { Agent, callable } from "agents";
import type { LanguageModel, ToolSet, UIMessage } from "ai";
import { generateText, tool } from "ai";
import { nanoid } from "nanoid";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";

import { createDbContext } from "#/db/server";
import {
	getWorkspaceAiChatModel,
	resolveWorkspaceAiChatModelId,
} from "#/features/workspaces/ai/models";
import { canReadWorkspace } from "#/features/workspaces/server/permissions";
import { listWorkspaceItemsForWorkspace } from "#/features/workspaces/server/queries";

const workspaceItemListInputSchema = z.object({
	limit: z
		.number()
		.int()
		.min(1)
		.max(100)
		.optional()
		.describe("Maximum number of items to return. Defaults to 80."),
	parentId: z
		.string()
		.nullable()
		.optional()
		.describe(
			"Optional parent folder item ID. Use null for root items. Omit to list all items.",
		),
});

type WorkspaceChatThreadRunState = "idle" | "running";

export interface WorkspaceChatThreadSummary {
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

export interface WorkspaceChatDirectoryState {
	isLoaded: boolean;
	threads: WorkspaceChatThreadSummary[];
}

interface WorkspaceChatThreadContext {
	id: string;
	workspaceId: string;
}

interface WorkspaceChatThreadMetaRow {
	id: string;
	workspace_id: string;
	title: string;
	status: WorkspaceChatThreadRunState;
	last_activity_at: number;
	last_user_message_at: number | null;
	last_assistant_message_at: number | null;
	last_viewed_at: number;
	title_generated_at: number | null;
	created_at: number;
	updated_at: number;
	archived_at: number | null;
}

class WorkspaceChatThreadNotFoundError extends Error {
	constructor() {
		super("Chat thread not found");
	}
}

class WorkspaceChatThreadForbiddenError extends Error {
	constructor() {
		super("Forbidden");
	}
}

export class WorkspaceChatDirectory extends Agent<
	Env,
	WorkspaceChatDirectoryState
> {
	static options = { sendIdentityOnConnect: false };

	initialState: WorkspaceChatDirectoryState = { isLoaded: false, threads: [] };

	onStart() {
		this.sql`CREATE TABLE IF NOT EXISTS chat_meta (
			id TEXT PRIMARY KEY,
			workspace_id TEXT NOT NULL,
			title TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'idle',
			last_activity_at INTEGER NOT NULL,
			last_user_message_at INTEGER,
			last_assistant_message_at INTEGER,
			last_viewed_at INTEGER NOT NULL,
			title_generated_at INTEGER,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			archived_at INTEGER
		)`;
		this._addTitleGeneratedAtColumnIfMissing();
		this.sql`CREATE INDEX IF NOT EXISTS chat_meta_workspace_activity_idx
			ON chat_meta (workspace_id, archived_at, last_activity_at)`;
		this._refreshState();
	}

	override async onBeforeSubAgent(
		_request: Request,
		{ className, name }: { className: string; name: string },
	): Promise<Request | Response | undefined> {
		if (className !== "WorkspaceChatAgent") {
			return new Response("Chat thread not found", { status: 404 });
		}

		try {
			await this._requireThreadMeta(name);
		} catch (error) {
			if (error instanceof WorkspaceChatThreadForbiddenError) {
				return new Response("Forbidden", { status: 403 });
			}

			return new Response("Chat thread not found", { status: 404 });
		}
	}

	@callable()
	async createThread(input: {
		workspaceId: string;
	}): Promise<WorkspaceChatThreadSummary> {
		const workspaceId = input.workspaceId.trim();

		if (!workspaceId) {
			throw new Error("workspaceId is required");
		}

		await this._assertCanReadWorkspace(workspaceId);

		const existingEmptyThread = this._getEmptyThreadSummary(workspaceId);

		if (existingEmptyThread) {
			return existingEmptyThread;
		}

		const id = nanoid(12);
		const now = Date.now();
		const title = getThreadTitle(now);

		await this.subAgent(WorkspaceChatAgent, id);

		try {
			this.sql`
				INSERT INTO chat_meta (
					id,
					workspace_id,
					title,
					status,
					last_activity_at,
					last_user_message_at,
					last_assistant_message_at,
					last_viewed_at,
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
					${now},
					NULL,
					NULL,
					${now},
					NULL,
					${now},
					${now},
					NULL
				)
			`;
		} catch (error) {
			await this.deleteSubAgent(WorkspaceChatAgent, id);
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
		await this.deleteSubAgent(WorkspaceChatAgent, threadId);
		this.sql`DELETE FROM chat_meta WHERE id = ${threadId}`;
		this._refreshState();
	}

	async getThreadContext(
		threadId: string,
	): Promise<WorkspaceChatThreadContext | null> {
		try {
			const thread = await this._requireThreadMeta(threadId);

			return {
				id: thread.id,
				workspaceId: thread.workspace_id,
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
				last_activity_at = ${now},
				last_user_message_at = ${now},
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
				last_activity_at = ${now},
				last_assistant_message_at = ${
					result.status === "completed" ? now : thread.last_assistant_message_at
				},
				last_viewed_at = ${options.viewed ? now : thread.last_viewed_at},
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

	async recordThreadRunFailed(threadId: string): Promise<void> {
		const now = Date.now();

		this.sql`
			UPDATE chat_meta
			SET status = 'idle', last_activity_at = ${now}, updated_at = ${now}
			WHERE id = ${threadId} AND archived_at IS NULL
		`;
		this._refreshState();
	}

	private _refreshState() {
		const registry = this.listSubAgents(WorkspaceChatAgent);
		const threadIds = new Set(registry.map((entry) => entry.name));
		const rows = this.sql<WorkspaceChatThreadMetaRow>`
			SELECT
				id,
				workspace_id,
				title,
				status,
				last_activity_at,
				last_user_message_at,
				last_assistant_message_at,
				last_viewed_at,
				title_generated_at,
				created_at,
				updated_at,
				archived_at
			FROM chat_meta
			WHERE archived_at IS NULL
		`;

		const threads = rows
			.filter((row) => threadIds.has(row.id))
			.map(mapThreadMetaRow)
			.sort(compareThreadRecentFirst);

		this.setState({ ...this.state, isLoaded: true, threads });
	}

	private _getThreadMeta(threadId: string) {
		const [thread] = this.sql<WorkspaceChatThreadMetaRow>`
			SELECT
				id,
				workspace_id,
				title,
				status,
				last_activity_at,
				last_user_message_at,
				last_assistant_message_at,
				last_viewed_at,
				title_generated_at,
				created_at,
				updated_at,
				archived_at
			FROM chat_meta
			WHERE id = ${threadId}
			LIMIT 1
		`;

		return thread ?? null;
	}

	private _getThreadSummary(threadId: string) {
		const thread = this._getThreadMeta(threadId);

		return thread ? mapThreadMetaRow(thread) : null;
	}

	private _getEmptyThreadSummary(workspaceId: string) {
		const registry = this.listSubAgents(WorkspaceChatAgent);
		const threadIds = new Set(registry.map((entry) => entry.name));
		const rows = this.sql<WorkspaceChatThreadMetaRow>`
			SELECT
				id,
				workspace_id,
				title,
				status,
				last_activity_at,
				last_user_message_at,
				last_assistant_message_at,
				last_viewed_at,
				title_generated_at,
				created_at,
				updated_at,
				archived_at
			FROM chat_meta
			WHERE workspace_id = ${workspaceId}
				AND archived_at IS NULL
				AND last_user_message_at IS NULL
			ORDER BY created_at DESC
			LIMIT 1
		`;
		const thread = rows.find((row) => threadIds.has(row.id));

		return thread ? mapThreadMetaRow(thread) : null;
	}

	private async _requireThreadMeta(
		threadId: string,
	): Promise<WorkspaceChatThreadMetaRow> {
		if (!this.hasSubAgent(WorkspaceChatAgent, threadId)) {
			throw new WorkspaceChatThreadNotFoundError();
		}

		const thread = this._getThreadMeta(threadId);

		if (!thread || thread.archived_at !== null) {
			throw new WorkspaceChatThreadNotFoundError();
		}

		try {
			await this._assertCanReadWorkspace(thread.workspace_id);
		} catch {
			throw new WorkspaceChatThreadForbiddenError();
		}

		return thread;
	}

	private _addTitleGeneratedAtColumnIfMissing() {
		try {
			this.sql`ALTER TABLE chat_meta ADD COLUMN title_generated_at INTEGER`;
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.toLowerCase().includes("duplicate column")
			) {
				return;
			}

			throw error;
		}
	}

	private async _assertCanReadWorkspace(workspaceId: string) {
		const dbContext = await createDbContext();

		try {
			const allowed = await canReadWorkspace(dbContext.db, {
				workspaceId,
				userId: this.name,
			});

			if (!allowed) {
				throw new Error("Forbidden");
			}
		} finally {
			await dbContext.dispose();
		}
	}
}

export class WorkspaceChatAgent extends Think<Env> {
	override maxSteps = 5;
	override messageConcurrency = "latest" as const;
	override chatRecovery = true;

	getModel(): LanguageModel {
		// Think requires a base model before `beforeTurn` runs. Normal UI sends
		// override this per request with the selected model from `ctx.body.modelId`.
		return getWorkersAiModel(
			resolveWorkspaceAiChatModelId(undefined),
			this.env,
			this.sessionAffinity,
		);
	}

	getSystemPrompt(): string {
		return getWorkspaceChatSystemPrompt();
	}

	getTools(): ToolSet {
		return {
			listWorkspaceItems: tool({
				description:
					"List visible items in the current workspace, including folder hierarchy IDs, item type, name, summary metadata, and timestamps.",
				inputSchema: workspaceItemListInputSchema,
				execute: async ({ limit = 80, parentId }) => {
					const thread = await this._getThreadContext();

					if (!thread) {
						throw new Error("Chat thread not found");
					}

					const dbContext = await createDbContext();

					try {
						const items = await listWorkspaceItemsForWorkspace(
							dbContext.db,
							thread.workspaceId,
						);
						const scopedItems =
							parentId === undefined
								? items
								: items.filter((item) => item.parentId === parentId);
						const returnedItems = scopedItems.slice(0, limit).map((item) => ({
							id: item.id,
							parentId: item.parentId,
							type: item.type,
							name: item.name,
							meta: item.meta,
							color: item.color,
							sortOrder: item.sortOrder,
							updatedAt: item.updatedAt,
						}));

						return {
							workspaceId: thread.workspaceId,
							filter: { parentId: parentId ?? null },
							totalItems: items.length,
							matchingItems: scopedItems.length,
							returnedItems,
						};
					} finally {
						await dbContext.dispose();
					}
				},
			}),
		};
	}

	async beforeTurn(ctx: TurnContext): Promise<TurnConfig | undefined> {
		const directory = await this.parentAgent(WorkspaceChatDirectory);
		const thread = await directory.getThreadContext(this.name);

		if (!thread) {
			throw new Error("Chat thread not found");
		}

		await directory.recordThreadRunStarted(this.name);

		const modelId = resolveWorkspaceAiChatModelId(ctx.body?.modelId);

		return {
			model: getWorkersAiModel(modelId, this.env, this.sessionAffinity),
			system: getWorkspaceChatSystemPrompt(thread.workspaceId),
		};
	}

	override async onChatResponse(result: ChatResponseResult) {
		const hasActiveConnections = Array.from(this.getConnections()).length > 0;

		try {
			const directory = await this.parentAgent(WorkspaceChatDirectory);
			await directory.recordThreadRunFinished(this.name, result, {
				viewed: hasActiveConnections,
			});

			const shouldGenerateTitle =
				result.status === "completed" &&
				(await directory.shouldGenerateThreadTitle(this.name));

			if (shouldGenerateTitle) {
				try {
					await directory.recordGeneratedThreadTitle(
						this.name,
						await this._generateTitleFromFirstUserMessage(),
					);
				} catch (error) {
					console.warn("[WorkspaceChatAgent] Failed to generate title", error);
				}
			}
		} catch (error) {
			console.warn("[WorkspaceChatAgent] Failed to update directory", error);
		}
	}

	override async onChatError(error: unknown) {
		try {
			const directory = await this.parentAgent(WorkspaceChatDirectory);
			await directory.recordThreadRunFailed(this.name);
		} catch (metadataError) {
			console.warn(
				"[WorkspaceChatAgent] Failed to clear directory run status",
				metadataError,
			);
		}

		return super.onChatError(error);
	}

	private async _getThreadContext() {
		const directory = await this.parentAgent(WorkspaceChatDirectory);
		return directory.getThreadContext(this.name);
	}

	private async _generateTitleFromFirstUserMessage() {
		const messages = await this.getMessages();
		const firstUserMessage = getFirstUserMessageText(messages);
		const titleModelId = resolveWorkspaceAiChatModelId(undefined);

		if (!firstUserMessage) {
			return undefined;
		}

		const result = await generateText({
			model: getWorkersAiModel(titleModelId, this.env, this.sessionAffinity),
			prompt: [
				"Write a concise chat title for this first user message.",
				"Return only the title. No quotes. No punctuation at the end.",
				"Use 2 to 6 words.",
				"",
				firstUserMessage,
			].join("\n"),
			temperature: 0.2,
		});
		return result.text;
	}
}

function getWorkersAiModel(
	modelId: ReturnType<typeof resolveWorkspaceAiChatModelId>,
	env: Env,
	sessionAffinity: string,
) {
	const workersAi = createWorkersAI({ binding: env.AI });

	return workersAi(getWorkspaceAiChatModel(modelId), {
		sessionAffinity,
	});
}

function getThreadTitle(now: number) {
	return `Chat ${new Date(now).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	})}`;
}

function normalizeGeneratedThreadTitle(value: string | undefined) {
	const title = value
		?.replace(/^["'`]+|["'`.]+$/g, "")
		.replace(/\s+/g, " ")
		.trim();

	if (!title) {
		return null;
	}

	return title.length > 64 ? `${title.slice(0, 61).trimEnd()}...` : title;
}

function getFirstUserMessageText(messages: UIMessage[]) {
	const firstUserMessage = messages.find((message) => message.role === "user");

	if (!firstUserMessage) {
		return "";
	}

	return firstUserMessage.parts
		.filter((part): part is { type: "text"; text: string } => {
			return part.type === "text";
		})
		.map((part) => part.text)
		.join("\n")
		.trim()
		.slice(0, 1000);
}

function getWorkspaceChatSystemPrompt(workspaceId?: string) {
	return [
		"You are Thinkex's workspace assistant.",
		workspaceId ? `You are scoped to workspace ${workspaceId}.` : undefined,
		"Use workspace tools when the user asks about workspace contents or structure.",
		"Do not claim to have read workspace content unless a tool result provides it.",
		"Keep answers concise, concrete, and action-oriented.",
	]
		.filter(Boolean)
		.join("\n");
}

function mapThreadMetaRow(
	row: WorkspaceChatThreadMetaRow,
): WorkspaceChatThreadSummary {
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

function compareThreadRecentFirst(
	left: WorkspaceChatThreadSummary,
	right: WorkspaceChatThreadSummary,
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
