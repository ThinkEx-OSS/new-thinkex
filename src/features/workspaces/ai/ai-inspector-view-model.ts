import type { AIInspectorEvent } from "#/features/workspaces/ai/ai-inspector";

export interface AIInspectorToolDefinitionView {
	name: string;
	description?: string;
	inputSchema?: unknown;
	metadata?: unknown;
	strict?: unknown;
	title?: string;
}

export interface AIInspectorMessageView {
	role?: string;
	text: string;
	toolCalls: AIInspectorToolCallPreview[];
	raw: unknown;
}

export interface AIInspectorToolCallPreview {
	toolCallId?: string;
	toolName?: string;
	input?: unknown;
	output?: unknown;
	text?: string;
	type?: string;
}

export interface AIInspectorToolCallView {
	id: string;
	toolName: string;
	stepNumber?: number;
	startedAt?: number;
	finishedAt?: number;
	durationMs?: number;
	input?: unknown;
	output?: unknown;
	error?: unknown;
	success?: boolean;
}

export interface AIInspectorStepView {
	stepNumber: number;
	startedAt?: number;
	finishedAt?: number;
	messages: AIInspectorMessageView[];
	text: string;
	reasoning: string;
	finishReason?: string;
	files?: unknown;
	providerMetadata?: unknown;
	sources?: unknown;
	usage?: unknown;
	request?: unknown;
	response?: unknown;
	warnings?: unknown;
	otherChunks: unknown[];
	toolCalls: AIInspectorToolCallView[];
}

export interface AIInspectorRunView {
	runId: string;
	startedAt?: number;
	finishedAt?: number;
	status: "running" | "completed" | "failed";
	modelId?: string;
	system?: string;
	thread?: unknown;
	body?: unknown;
	tools: AIInspectorToolDefinitionView[];
	messages: AIInspectorMessageView[];
	steps: AIInspectorStepView[];
	toolCalls: AIInspectorToolCallView[];
	eventCount: number;
	usage?: unknown;
	error?: unknown;
	rawEvents: AIInspectorEvent[];
}

export function getAIInspectorRunViews(
	events: AIInspectorEvent[],
): AIInspectorRunView[] {
	const groupedEvents = new Map<string, AIInspectorEvent[]>();

	for (const event of events) {
		const runEvents = groupedEvents.get(event.runId) ?? [];
		runEvents.push(event);
		groupedEvents.set(event.runId, runEvents);
	}

	return Array.from(groupedEvents, ([runId, runEvents]) =>
		buildRunView(runId, runEvents.sort(bySequence)),
	).sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
}

function buildRunView(runId: string, events: AIInspectorEvent[]) {
	const run: AIInspectorRunView = {
		runId,
		status: "running",
		tools: [],
		messages: [],
		steps: [],
		toolCalls: [],
		eventCount: events.length,
		rawEvents: events,
	};
	const steps = new Map<number, AIInspectorStepView>();
	const toolCalls = new Map<string, AIInspectorToolCallView>();
	let currentStepNumber = 0;

	for (const event of events) {
		const payload = asRecord(event.payload);

		switch (event.type) {
			case "turn.started":
				run.startedAt = event.createdAt;
				run.modelId = getString(payload.modelId);
				run.system = getString(payload.system);
				run.thread = payload.thread;
				run.body = payload.body;
				run.tools = parseToolDefinitions(payload.tools);
				run.messages = parseMessages(payload.messages);
				break;
			case "step.started": {
				currentStepNumber = getStepNumber(payload, steps.size + 1);
				const step = getStep(steps, currentStepNumber);
				step.startedAt = event.createdAt;
				step.messages = parseMessages(payload.messages);
				break;
			}
			case "chunk": {
				const step = getStep(steps, currentStepNumber || 1);
				applyChunk(step, event.payload);
				break;
			}
			case "tool.started": {
				const toolCall = getToolCall(toolCalls, payload);
				toolCall.startedAt = event.createdAt;
				toolCall.stepNumber = getStepNumber(payload, currentStepNumber || 1);
				toolCall.input = payload.input;
				break;
			}
			case "tool.finished": {
				const toolCall = getToolCall(toolCalls, payload);
				toolCall.finishedAt = event.createdAt;
				toolCall.durationMs = getNumber(payload.durationMs);
				toolCall.stepNumber = getStepNumber(payload, currentStepNumber || 1);
				toolCall.input = payload.input ?? toolCall.input;
				toolCall.output = payload.output;
				toolCall.error = payload.error;
				toolCall.success = payload.success === true;
				break;
			}
			case "step.finished": {
				const step = getStep(steps, currentStepNumber || steps.size || 1);
				step.finishedAt = event.createdAt;
				applyChunkSummary(step, payload.chunkSummary);
				step.text = getString(payload.text) ?? step.text;
				step.reasoning = normalizeText(payload.reasoning) || step.reasoning;
				step.finishReason = getString(payload.finishReason);
				step.files = payload.files;
				step.providerMetadata = payload.providerMetadata;
				step.sources = payload.sources;
				step.usage = payload.usage;
				step.request = payload.request;
				step.response = payload.response;
				step.warnings = payload.warnings;
				addStepToolCalls(
					step,
					toolCalls,
					payload.toolCalls,
					payload.toolResults,
				);
				run.usage = payload.usage ?? run.usage;
				break;
			}
			case "turn.finished":
				run.finishedAt = event.createdAt;
				run.status =
					getNestedString(payload, ["result", "status"]) === "failed"
						? "failed"
						: "completed";
				break;
			case "turn.error":
				run.finishedAt = event.createdAt;
				run.status = "failed";
				run.error = event.payload;
				break;
		}
	}

	run.steps = Array.from(steps.values()).sort(
		(a, b) => a.stepNumber - b.stepNumber,
	);
	run.toolCalls = Array.from(toolCalls.values()).sort(
		(a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0),
	);

	for (const step of run.steps) {
		step.toolCalls = run.toolCalls.filter(
			(toolCall) => toolCall.stepNumber === step.stepNumber,
		);
	}

	return run;
}

function getStep(steps: Map<number, AIInspectorStepView>, stepNumber: number) {
	let step = steps.get(stepNumber);
	if (!step) {
		step = {
			stepNumber,
			messages: [],
			text: "",
			reasoning: "",
			otherChunks: [],
			toolCalls: [],
		};
		steps.set(stepNumber, step);
	}
	return step;
}

function applyChunkSummary(step: AIInspectorStepView, chunkSummary: unknown) {
	const record = asRecord(chunkSummary);
	const text = getString(record.text);
	if (text && !step.text) {
		step.text = text;
	}

	const reasoning = getString(record.reasoning);
	if (reasoning && !step.reasoning) {
		step.reasoning = reasoning;
	}

	if (Array.isArray(record.otherChunks)) {
		step.otherChunks = record.otherChunks;
	}

	if (Array.isArray(record.rawStreamEvents)) {
		step.otherChunks = record.rawStreamEvents;
	}
}

function applyChunk(step: AIInspectorStepView, chunk: unknown) {
	const payload = asRecord(chunk);
	const type = getString(payload.type);
	const delta = getString(payload.text) ?? getString(payload.delta) ?? "";

	if (type === "text-delta") {
		step.text += delta;
		return;
	}

	if (type === "reasoning-delta") {
		step.reasoning += delta;
		return;
	}

	if (step.otherChunks.length < 12) {
		step.otherChunks.push(chunk);
	}
}

function addStepToolCalls(
	step: AIInspectorStepView,
	toolCalls: Map<string, AIInspectorToolCallView>,
	rawToolCalls: unknown,
	rawToolResults: unknown,
) {
	if (Array.isArray(rawToolCalls)) {
		for (const rawToolCall of rawToolCalls) {
			const record = asRecord(rawToolCall);
			const toolCall = getToolCall(toolCalls, record);
			toolCall.stepNumber ??= step.stepNumber;
			toolCall.input ??= record.input ?? record.args;
		}
	}

	if (Array.isArray(rawToolResults)) {
		for (const rawToolResult of rawToolResults) {
			const record = asRecord(rawToolResult);
			const toolCall = getToolCall(toolCalls, record);
			toolCall.stepNumber ??= step.stepNumber;
			toolCall.output ??= record.output ?? record.result;
			toolCall.error ??= record.error;
		}
	}
}

function getToolCall(
	toolCalls: Map<string, AIInspectorToolCallView>,
	payload: Record<string, unknown>,
) {
	const id =
		getString(payload.toolCallId) ?? getString(payload.id) ?? "unknown";
	let toolCall = toolCalls.get(id);
	if (!toolCall) {
		toolCall = {
			id,
			toolName:
				getString(payload.toolName) ?? getString(payload.name) ?? "unknownTool",
		};
		toolCalls.set(id, toolCall);
	}
	toolCall.toolName =
		getString(payload.toolName) ?? getString(payload.name) ?? toolCall.toolName;
	return toolCall;
}

function parseToolDefinitions(tools: unknown): AIInspectorToolDefinitionView[] {
	if (!Array.isArray(tools)) {
		return [];
	}

	return tools.map((tool) => {
		const record = asRecord(tool);
		return {
			name: getString(record.name) ?? "unknownTool",
			description: getString(record.description),
			inputSchema: record.inputSchema,
			metadata: record.metadata,
			strict: record.strict,
			title: getString(record.title),
		};
	});
}

function parseMessages(messages: unknown): AIInspectorMessageView[] {
	if (!Array.isArray(messages)) {
		return [];
	}

	return messages.map((message) => {
		const record = asRecord(message);
		const content = record.parts ?? record.content;
		const toolCalls = parseToolPreviews(content);
		return {
			role: getString(record.role),
			text: normalizeText(content),
			toolCalls,
			raw: message,
		};
	});
}

function parseToolPreviews(content: unknown): AIInspectorToolCallPreview[] {
	if (!Array.isArray(content)) {
		return [];
	}

	return content.flatMap((part) => {
		const record = asRecord(part);
		const toolName = getString(record.toolName);
		const toolCallId = getString(record.toolCallId);
		if (!toolName && !toolCallId) {
			return [];
		}

		return {
			type: getString(record.type),
			toolCallId,
			toolName,
			input: record.input,
			output: record.output ?? record.result,
			text: getString(record.text),
		};
	});
}

function normalizeText(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	if (!Array.isArray(value)) {
		return "";
	}

	return value
		.map((part) => {
			const record = asRecord(part);
			return getString(record.text) ?? "";
		})
		.filter(Boolean)
		.join("\n");
}

function getStepNumber(payload: Record<string, unknown>, fallback: number) {
	const stepNumber = getNumber(payload.stepNumber);
	return typeof stepNumber === "number" ? stepNumber + 1 : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: {};
}

function getNestedString(
	record: Record<string, unknown>,
	path: string[],
): string | undefined {
	let current: unknown = record;
	for (const key of path) {
		current = asRecord(current)[key];
	}
	return getString(current);
}

function getString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}

function bySequence(a: AIInspectorEvent, b: AIInspectorEvent) {
	return a.sequence - b.sequence;
}
