import type {
	ChatResponseResult,
	Session,
	ToolCallResultContext,
	TurnConfig,
	TurnContext,
} from "@cloudflare/think";
import { Think } from "@cloudflare/think";
import type { LanguageModel, ToolSet, UIMessage } from "ai";
import { generateText, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";

import {
	DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
	getWorkspaceAiChatModel,
	resolveWorkspaceAiChatModelId,
} from "#/features/workspaces/ai/models";
import type { UserAIStore } from "#/features/workspaces/ai/user-ai-agents";
import { listWorkspaceKernelItems } from "#/features/workspaces/kernel/workspace-kernel-access";

const workspaceItemListInputSchema = z.object({
	limit: z
		.number()
		.int()
		.min(1)
		.max(200)
		.optional()
		.describe("Maximum number of entries to return. Defaults to 100."),
	path: z
		.string()
		.min(1)
		.optional()
		.describe(
			"Absolute workspace path to list. Defaults to the workspace root (/).",
		),
	recursive: z
		.boolean()
		.optional()
		.describe(
			"List nested descendants, like ls -R. Defaults to false for immediate children only.",
		),
});

export function createAIThreadClass(getUserAIStore: () => typeof UserAIStore) {
	return class AIThread extends Think<Env> {
		override maxSteps = 5;
		override messageConcurrency = "latest" as const;
		override chatRecovery = true;
		private shouldRefreshSessionPrompt = false;

		getModel(): LanguageModel {
			// Think requires a base model before `beforeTurn` runs. Normal UI sends
			// override this per request with the selected model from `ctx.body.modelId`.
			return getWorkersAiModel(
				DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
				this.env,
				this.sessionAffinity,
			);
		}

		getSystemPrompt(): string {
			return getAIThreadSoulPrompt();
		}

		configureSession(session: Session) {
			return session
				.withContext("soul", {
					provider: {
						get: async () => getAIThreadSoulPrompt(),
					},
				})
				.withContext("memory", {
					description:
						"Short durable facts about this user, workspace, thread goals, preferences, and decisions that should help future turns. Keep this concise. Do not store source-of-truth workspace content here.",
					maxTokens: 1500,
				})
				.withCachedPrompt();
		}

		getTools(): ToolSet {
			return {
				listWorkspaceItems: tool({
					description:
						"List the real ThinkEx workspace like ls. Use absolute paths such as /. By default this returns immediate children; set recursive to true for a tree-style listing.",
					inputSchema: workspaceItemListInputSchema,
					execute: async ({ limit, path, recursive }) => {
						const thread = await this._getThreadContext();

						if (!thread) {
							throw new Error("Chat thread not found");
						}

						return await listWorkspaceKernelItems({
							workspaceId: thread.workspaceId,
							userId: thread.userId,
							path,
							recursive,
							limit,
						});
					},
				}),
			};
		}

		async beforeTurn(ctx: TurnContext): Promise<TurnConfig | undefined> {
			const directory = await this.parentAgent(getUserAIStore());
			const thread = await directory.getThreadContext(this.name);

			if (!thread) {
				throw new Error("Chat thread not found");
			}

			await directory.recordThreadRunStarted(this.name);

			const modelId = resolveWorkspaceAiChatModelId(ctx.body?.modelId);

			return {
				model: getWorkersAiModel(modelId, this.env, this.sessionAffinity),
				system: getAIThreadSystemPromptForWorkspace(
					ctx.system,
					thread.workspaceId,
				),
			};
		}

		override async onChatResponse(result: ChatResponseResult) {
			const hasActiveConnections = Array.from(this.getConnections()).length > 0;

			try {
				const directory = await this.parentAgent(getUserAIStore());
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
						console.warn("[AIThread] Failed to generate title", error);
					}
				}
			} catch (error) {
				console.warn("[AIThread] Failed to update directory", error);
			} finally {
				await this._refreshSessionPromptIfNeeded();
			}
		}

		override onChatError(error: unknown) {
			void this.keepAliveWhile(async () => {
				try {
					const directory = await this.parentAgent(getUserAIStore());
					await directory.recordThreadRunFailed(this.name);
				} catch (metadataError) {
					console.warn(
						"[AIThread] Failed to clear directory run status",
						metadataError,
					);
				}

				await this._refreshSessionPromptIfNeeded();
			});

			return super.onChatError(error);
		}

		afterToolCall(ctx: ToolCallResultContext): void {
			if (ctx.success && ctx.toolName === "set_context") {
				this.shouldRefreshSessionPrompt = true;
			}
		}

		private async _getThreadContext() {
			const directory = await this.parentAgent(getUserAIStore());
			return directory.getThreadContext(this.name);
		}

		private async _refreshSessionPromptIfNeeded() {
			if (!this.shouldRefreshSessionPrompt) {
				return;
			}

			this.shouldRefreshSessionPrompt = false;

			try {
				await this.session.refreshSystemPrompt();
			} catch (error) {
				console.warn("[AIThread] Failed to refresh session prompt", error);
			}
		}

		private async _generateTitleFromFirstUserMessage() {
			const messages = await this.getMessages();
			const firstUserMessage = getFirstUserMessageText(messages);
			const titleModelId = DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID;

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
	};
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

function getAIThreadSoulPrompt() {
	return [
		"You are Thinkex's workspace assistant.",
		"WorkspaceKernel is the source of truth for user-visible workspace items, files, revisions, events, and permissions.",
		"Your private Think workspace is scratch space only. Do not treat private scratch files as user-visible workspace state.",
		"Use workspace tools when the user asks about workspace contents or structure.",
		"Do not claim to have read workspace content unless a tool result provides it.",
		"Use memory only for durable, concise user preferences, workspace goals, thread goals, and decisions that should help future turns in this thread.",
		"Do not update memory for transient requests or information already stored in WorkspaceKernel.",
		"Do not store full documents, item bodies, large file text, secrets, or source-of-truth workspace state in memory.",
		"User-visible workspace output must be created or changed through product workspace tools.",
		"Keep answers concise, concrete, and action-oriented.",
	]
		.filter(Boolean)
		.join("\n");
}

function getAIThreadSystemPromptForWorkspace(
	system: string,
	workspaceId: string,
) {
	return [
		system,
		[
			"Current ThinkEx runtime scope:",
			`- Workspace id: ${workspaceId}`,
			"- Use absolute workspace paths such as / when calling workspace tools.",
		].join("\n"),
	].join("\n\n");
}
