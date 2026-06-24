import type {
	ChatErrorClassification,
	ChatErrorContext,
	ChatResponseResult,
	ChunkContext,
	PrepareStepContext,
	StepContext,
	ToolCallContext,
	ToolCallResultContext,
	TurnContext,
} from "@cloudflare/think";

import {
	buildPostHogAiInputFromPrompt,
	buildPostHogAiInputFromStep,
	buildPostHogAiOutputFromStep,
	buildPostHogAiOutputFromText,
	extractTokenUsage,
	parseGatewayModel,
} from "#/features/workspaces/ai/ai-thread-posthog-serialization";
import type { AIThreadContext } from "#/features/workspaces/ai/ai-thread-metadata";
import {
	getWorkspaceAiChatModel,
	type WorkspaceAiChatModelId,
} from "#/features/workspaces/ai/models";
import {
	capturePostHogAiGeneration,
	capturePostHogAiSpan,
} from "#/integrations/posthog/ai-observability";
import { capturePostHogServerEvent } from "#/integrations/posthog/server";

interface PostHogTurnState {
	distinctId: string;
	sessionId: string;
	traceId: string;
	turnRootSpanId: string;
	workspaceId: string;
	modelId: string;
	gatewayModel: string;
	stepCount: number;
	turnStartedAt: number;
	currentStepStartedAt?: number;
	currentStepFirstTokenAt?: number;
	activeToolSpans: Map<string, { spanId: string; startedAt: number }>;
}

export interface AIThreadPostHogTraceContext {
	distinctId: string;
	sessionId: string;
	traceId: string;
	workspaceId: string;
	parentSpanId: string;
}

export class AIThreadPostHogRecorder {
	private turn: PostHogTurnState | null = null;

	recordTurnStarted(input: {
		ctx: TurnContext;
		modelId: WorkspaceAiChatModelId;
		thread: AIThreadContext;
	}) {
		const traceId = crypto.randomUUID();
		const turnRootSpanId = crypto.randomUUID();
		const gatewayModel = getWorkspaceAiChatModel(input.modelId);

		this.turn = {
			distinctId: input.thread.userId,
			sessionId: input.thread.id,
			traceId,
			turnRootSpanId,
			workspaceId: input.thread.workspaceId,
			modelId: input.modelId,
			gatewayModel,
			stepCount: 0,
			turnStartedAt: Date.now(),
			activeToolSpans: new Map(),
		};

		capturePostHogServerEvent({
			distinctId: input.thread.userId,
			event: "ai_turn_started",
			properties: {
				thread_id: input.thread.id,
				workspace_id: input.thread.workspaceId,
				trace_id: traceId,
				model_id: input.modelId,
				continuation: Boolean(input.ctx.continuation),
			},
		});
	}

	recordStepStarted(_ctx: PrepareStepContext) {
		if (!this.turn) {
			return;
		}

		this.turn.currentStepStartedAt = Date.now();
		this.turn.currentStepFirstTokenAt = undefined;
	}

	recordToolStarted(ctx: ToolCallContext) {
		if (!this.turn) {
			return;
		}

		this.turn.activeToolSpans.set(ctx.toolCallId, {
			spanId: crypto.randomUUID(),
			startedAt: Date.now(),
		});
	}

	recordToolFinished(ctx: ToolCallResultContext) {
		const turn = this.turn;
		if (!turn) {
			return;
		}

		const activeToolSpan = turn.activeToolSpans.get(ctx.toolCallId);
		turn.activeToolSpans.delete(ctx.toolCallId);

		if (!activeToolSpan) {
			return;
		}

		const latencySeconds = ctx.durationMs / 1000;

		capturePostHogAiSpan({
			distinctId: turn.distinctId,
			traceId: turn.traceId,
			sessionId: turn.sessionId,
			spanId: activeToolSpan.spanId,
			spanName: ctx.toolName,
			parentId: turn.turnRootSpanId,
			latencySeconds,
			isError: !ctx.success,
			error: ctx.success ? undefined : ctx.error,
			properties: {
				thread_id: turn.sessionId,
				workspace_id: turn.workspaceId,
				tool_call_id: ctx.toolCallId,
				step_number: ctx.stepNumber,
				tool_input: ctx.input,
				tool_output: ctx.success ? ctx.output : undefined,
			},
		});

		capturePostHogServerEvent({
			distinctId: turn.distinctId,
			event: "ai_tool_invoked",
			properties: {
				thread_id: turn.sessionId,
				workspace_id: turn.workspaceId,
				trace_id: turn.traceId,
				tool_name: ctx.toolName,
				success: ctx.success,
				duration_ms: ctx.durationMs,
			},
		});
	}

	recordStepFinished(ctx: StepContext) {
		const turn = this.turn;
		if (!turn) {
			return;
		}

		turn.stepCount += 1;

		const { provider, model } = parseGatewayModel(turn.gatewayModel);
		const stepStartedAt = turn.currentStepStartedAt ?? turn.turnStartedAt;
		const latencySeconds = (Date.now() - stepStartedAt) / 1000;
		const timeToFirstToken =
			turn.currentStepFirstTokenAt !== undefined
				? (turn.currentStepFirstTokenAt - stepStartedAt) / 1000
				: undefined;

		capturePostHogAiGeneration({
			distinctId: turn.distinctId,
			traceId: turn.traceId,
			sessionId: turn.sessionId,
			spanName: "chat_step",
			parentId: turn.turnRootSpanId,
			spanId: crypto.randomUUID(),
			provider,
			model,
			input: buildPostHogAiInputFromStep(ctx),
			output: buildPostHogAiOutputFromStep(ctx),
			usage: extractTokenUsage(ctx.usage),
			latency: latencySeconds,
			timeToFirstToken,
			stopReason: ctx.finishReason,
			properties: {
				thread_id: turn.sessionId,
				workspace_id: turn.workspaceId,
				model_id: turn.modelId,
				step_number: ctx.stepNumber,
				feature: "workspace-chat",
				$ai_stream: timeToFirstToken !== undefined,
			},
		});

		turn.currentStepStartedAt = undefined;
		turn.currentStepFirstTokenAt = undefined;
	}

	recordChunk(ctx: ChunkContext) {
		const turn = this.turn;
		if (!turn || turn.currentStepFirstTokenAt !== undefined) {
			return;
		}

		const chunk = ctx.chunk as Record<string, unknown> | undefined;
		if (chunk?.type === "text-delta" || chunk?.type === "reasoning-delta") {
			turn.currentStepFirstTokenAt = Date.now();
		}
	}

	recordTurnFinished(result: ChatResponseResult) {
		const turn = this.turn;
		if (!turn) {
			return;
		}

		capturePostHogServerEvent({
			distinctId: turn.distinctId,
			event: "ai_turn_completed",
			properties: {
				thread_id: turn.sessionId,
				workspace_id: turn.workspaceId,
				trace_id: turn.traceId,
				status: result.status,
				step_count: turn.stepCount,
			},
		});

		this.turn = null;
	}

	recordTurnError(
		error: unknown,
		input?: {
			errorStage?: ChatErrorContext["stage"];
			errorClassification?: ChatErrorClassification;
		},
	) {
		const turn = this.turn;
		if (!turn) {
			return;
		}

		capturePostHogServerEvent({
			distinctId: turn.distinctId,
			event: "ai_turn_failed",
			properties: {
				thread_id: turn.sessionId,
				workspace_id: turn.workspaceId,
				trace_id: turn.traceId,
				error_stage: input?.errorStage ?? null,
				error_classification: input?.errorClassification ?? null,
				error_message: error instanceof Error ? error.message : String(error),
			},
		});

		this.turn = null;
	}

	getActiveTraceContext(): AIThreadPostHogTraceContext | null {
		if (!this.turn) {
			return null;
		}

		return {
			distinctId: this.turn.distinctId,
			sessionId: this.turn.sessionId,
			traceId: this.turn.traceId,
			workspaceId: this.turn.workspaceId,
			parentSpanId: this.turn.turnRootSpanId,
		};
	}

	recordAuxiliaryGeneration(input: {
		feature: "compaction" | "thread-title";
		gatewayModel: string;
		prompt: string;
		text: string;
		usage?: unknown;
		latencySeconds: number;
		thread: Pick<AIThreadContext, "id" | "workspaceId" | "userId">;
		traceContext?: AIThreadPostHogTraceContext | null;
	}) {
		const traceContext = input.traceContext;
		const traceId = traceContext?.traceId ?? crypto.randomUUID();
		const parentId = traceContext?.parentSpanId;
		const distinctId = traceContext?.distinctId ?? input.thread.userId;
		const sessionId = traceContext?.sessionId ?? input.thread.id;
		const workspaceId = traceContext?.workspaceId ?? input.thread.workspaceId;
		const { provider, model } = parseGatewayModel(input.gatewayModel);

		capturePostHogAiGeneration({
			distinctId,
			traceId,
			sessionId,
			spanName: input.feature,
			parentId,
			spanId: crypto.randomUUID(),
			provider,
			model,
			input: buildPostHogAiInputFromPrompt(input.prompt),
			output: buildPostHogAiOutputFromText(input.text),
			usage: extractTokenUsage(input.usage),
			latency: input.latencySeconds,
			properties: {
				thread_id: input.thread.id,
				workspace_id: workspaceId,
				feature: input.feature,
			},
		});
	}
}
