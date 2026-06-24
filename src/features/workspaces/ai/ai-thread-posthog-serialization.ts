import type { StepContext } from "@cloudflare/think";

export function parseGatewayModel(gatewayModel: string) {
	const slashIndex = gatewayModel.indexOf("/");

	if (slashIndex === -1) {
		return {
			provider: "vercel-ai-gateway",
			model: gatewayModel,
		};
	}

	return {
		provider: gatewayModel.slice(0, slashIndex),
		model: gatewayModel.slice(slashIndex + 1),
	};
}

export function extractTokenUsage(usage: unknown) {
	if (!usage || typeof usage !== "object") {
		return {};
	}

	const record = usage as Record<string, unknown>;

	return {
		inputTokens:
			typeof record.inputTokens === "number"
				? record.inputTokens
				: typeof record.promptTokens === "number"
					? record.promptTokens
					: undefined,
		outputTokens:
			typeof record.outputTokens === "number"
				? record.outputTokens
				: typeof record.completionTokens === "number"
					? record.completionTokens
					: undefined,
	};
}

export function buildPostHogAiInputFromPrompt(prompt: string) {
	return [{ role: "user", content: prompt }];
}

export function buildPostHogAiOutputFromText(text: string) {
	return [{ role: "assistant", content: text }];
}

export function buildPostHogAiInputFromStep(ctx: StepContext) {
	const request = ctx.request as Record<string, unknown> | undefined;

	if (!request || typeof request !== "object") {
		return [];
	}

	const body = request.body;
	if (!body || typeof body !== "object") {
		return [];
	}

	const bodyRecord = body as Record<string, unknown>;

	if (Array.isArray(bodyRecord.messages)) {
		return bodyRecord.messages;
	}

	if (typeof bodyRecord.prompt === "string") {
		return buildPostHogAiInputFromPrompt(bodyRecord.prompt);
	}

	return [];
}

export function buildPostHogAiOutputFromStep(ctx: StepContext) {
	if (ctx.text) {
		return buildPostHogAiOutputFromText(ctx.text);
	}

	const response = ctx.response as Record<string, unknown> | undefined;
	const messages = response?.messages;

	if (Array.isArray(messages)) {
		return messages;
	}

	return [];
}
