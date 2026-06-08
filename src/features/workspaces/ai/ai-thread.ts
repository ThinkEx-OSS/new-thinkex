import type {
	ChatRecoveryConfig,
	ChatResponseResult,
	ChunkContext,
	PrepareStepContext,
	Session,
	StepConfig,
	StepContext,
	ToolCallContext,
	ToolCallDecision,
	ToolCallResultContext,
	TurnConfig,
	TurnContext,
} from "@cloudflare/think";
import { Think } from "@cloudflare/think";
import type { LanguageModel, ToolSet } from "ai";

import type { AIInspectorSnapshot } from "#/features/workspaces/ai/ai-inspector";
import { AIThreadInspectorRecorder } from "#/features/workspaces/ai/ai-thread-inspector-recorder";
import {
	AI_THREAD_ACTIVE_TOOLS,
	createAIThreadTools,
	generateAIThreadTitle,
	getAIThreadSoulPrompt,
	getAIThreadSystemPromptForWorkspace,
	getWorkersAiModel,
} from "#/features/workspaces/ai/ai-thread-runtime";
import {
	DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
	resolveWorkspaceAiChatModelId,
} from "#/features/workspaces/ai/models";
import type { UserAIStore } from "#/features/workspaces/ai/user-ai-agents";

const aiThreadChatRecovery = {
	noProgressTimeoutMs: 90_000,
	terminalMessage:
		"The assistant was interrupted and could not recover this turn.",
	onExhausted: (ctx) => {
		console.warn("[AIThread] Chat recovery exhausted", {
			incidentId: ctx.incidentId,
			reason: ctx.reason,
			recoveryKind: ctx.recoveryKind,
			requestId: ctx.requestId,
		});
	},
} satisfies ChatRecoveryConfig;

export function createAIThreadClass(getUserAIStore: () => typeof UserAIStore) {
	return class AIThread extends Think<Env> {
		override maxSteps = 5;
		override messageConcurrency = "latest" as const;
		override chatRecovery = aiThreadChatRecovery;
		override chatStreamStallTimeoutMs = 90_000;
		private shouldRefreshSessionPrompt = false;
		private readonly inspector = new AIThreadInspectorRecorder(this);

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
			return createAIThreadTools({
				env: this.env,
				workspace: this.workspace,
				getThreadContext: () => this._getThreadContext(),
			});
		}

		async beforeTurn(ctx: TurnContext): Promise<TurnConfig | undefined> {
			const directory = await this.parentAgent(getUserAIStore());
			const thread = await directory.getThreadContext(this.name);

			if (!thread) {
				throw new Error("Chat thread not found");
			}

			await directory.recordThreadRunStarted(this.name);

			const modelId = resolveWorkspaceAiChatModelId(ctx.body?.modelId);
			const system = getAIThreadSystemPromptForWorkspace(
				ctx.system,
				thread.promptScope,
				{
					timeZone: getBodyString(ctx.body, "timeZone"),
				},
			);

			await this.inspector.recordTurnStarted({
				ctx,
				modelId,
				system,
				thread,
			});

			return {
				activeTools: [...AI_THREAD_ACTIVE_TOOLS],
				model: getWorkersAiModel(modelId, this.env, this.sessionAffinity),
				system,
			};
		}

		beforeStep(ctx: PrepareStepContext): StepConfig | undefined {
			this.inspector.recordStepStarted(ctx);

			return undefined;
		}

		beforeToolCall(ctx: ToolCallContext): ToolCallDecision | undefined {
			this.inspector.recordToolStarted(ctx);

			return undefined;
		}

		override async onChatResponse(result: ChatResponseResult) {
			this.inspector.recordTurnFinished(result);
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
			this.inspector.recordTurnError(error);
			void this.keepAliveWhile(async () => {
				try {
					const directory = await this.parentAgent(getUserAIStore());
					await directory.recordThreadRunFailed(this.name, error);
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
			this.inspector.recordToolFinished(ctx);

			if (ctx.success && ctx.toolName === "set_context") {
				this.shouldRefreshSessionPrompt = true;
			}
		}

		onStepFinish(ctx: StepContext): void {
			this.inspector.recordStepFinished(ctx);
		}

		onChunk(ctx: ChunkContext): void {
			this.inspector.recordChunk(ctx);
		}

		getInspectorSnapshot(): AIInspectorSnapshot {
			return this.inspector.getSnapshot(this.name);
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
			return await generateAIThreadTitle({
				env: this.env,
				messages: await this.getMessages(),
				sessionAffinity: this.sessionAffinity,
			});
		}
	};
}

function getBodyString(body: Record<string, unknown> | undefined, key: string) {
	const value = body?.[key];
	return typeof value === "string" ? value : undefined;
}
