import type {
	ChatResponseResult,
	TurnConfig,
	TurnContext,
} from "@cloudflare/think";
import { Think } from "@cloudflare/think";
import type { LanguageModel, ToolSet, UIMessage } from "ai";
import { generateText, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";

import {
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

export function createAIThreadClass(getUserAIStore: () => typeof UserAIStore) {
	return class AIThread extends Think<Env> {
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
			return getAIThreadSystemPrompt();
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

						return await listWorkspaceKernelItems({
							workspaceId: thread.workspaceId,
							userId: thread.userId,
							parentId,
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
				system: getAIThreadSystemPrompt(thread.workspaceId),
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
			}
		}

		override async onChatError(error: unknown) {
			try {
				const directory = await this.parentAgent(getUserAIStore());
				await directory.recordThreadRunFailed(this.name);
			} catch (metadataError) {
				console.warn(
					"[AIThread] Failed to clear directory run status",
					metadataError,
				);
			}

			return super.onChatError(error);
		}

		private async _getThreadContext() {
			const directory = await this.parentAgent(getUserAIStore());
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

function getAIThreadSystemPrompt(workspaceId?: string) {
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
