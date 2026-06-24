import { waitUntil } from "cloudflare:workers";
import { captureAiGeneration, type CaptureAiGenerationOptions } from "@posthog/ai";
import type { PostHog } from "posthog-node";

import { isPostHogAiObservabilityEnabled } from "#/integrations/posthog/config";
import { getPostHogServerClient } from "#/integrations/posthog/server";

export interface PostHogAiSpanInput {
	distinctId: string;
	traceId: string;
	sessionId: string;
	spanId: string;
	spanName: string;
	parentId?: string;
	latencySeconds?: number;
	isError?: boolean;
	error?: unknown;
	properties?: Record<string, unknown>;
}

function getPostHogAiClient(): PostHog | null {
	if (!isPostHogAiObservabilityEnabled) {
		return null;
	}

	return getPostHogServerClient() ?? null;
}

function schedulePostHogAiTask(task: Promise<void>, context: Record<string, unknown>) {
	waitUntil(
		task.catch((error) => {
			console.error("PostHog AI capture failed.", {
				...context,
				error,
			});
		}),
	);
}

function appendAiTraceProperties(
	properties: Record<string, unknown>,
	input: {
		traceId?: string;
		sessionId?: string;
		spanId?: string;
		spanName?: string;
		parentId?: string;
	},
) {
	if (input.traceId) {
		properties.$ai_trace_id = input.traceId;
	}

	if (input.sessionId) {
		properties.$ai_session_id = input.sessionId;
	}

	if (input.spanId) {
		properties.$ai_span_id = input.spanId;
	}

	if (input.spanName) {
		properties.$ai_span_name = input.spanName;
	}

	if (input.parentId) {
		properties.$ai_parent_id = input.parentId;
	}
}

export function capturePostHogAiGeneration(
	options: CaptureAiGenerationOptions & {
		distinctId: string;
		sessionId?: string;
		spanName?: string;
		parentId?: string;
		spanId?: string;
	},
) {
	const client = getPostHogAiClient();
	if (!client) {
		return;
	}

	const properties: Record<string, unknown> = {
		...options.properties,
	};

	appendAiTraceProperties(properties, {
		traceId: options.traceId,
		sessionId: options.sessionId,
		spanId: options.spanId,
		spanName: options.spanName,
		parentId: options.parentId,
	});

	schedulePostHogAiTask(
		captureAiGeneration(client, {
			...options,
			privacyMode: false,
			captureImmediate: true,
			properties,
		}),
		{
			type: "ai_generation",
			spanName: options.spanName,
		},
	);
}

export function capturePostHogAiSpan(input: PostHogAiSpanInput) {
	const client = getPostHogAiClient();
	if (!client) {
		return;
	}

	const properties: Record<string, unknown> = {
		...input.properties,
	};

	appendAiTraceProperties(properties, input);

	if (input.latencySeconds !== undefined) {
		properties.$ai_latency = input.latencySeconds;
	}

	if (input.isError) {
		properties.$ai_is_error = true;
		properties.$ai_error =
			input.error instanceof Error
				? input.error.message
				: typeof input.error === "string"
					? input.error
					: JSON.stringify(input.error);
	}

	schedulePostHogAiTask(
		client
			.captureImmediate({
				distinctId: input.distinctId,
				event: "$ai_span",
				properties,
			})
			.then(() => undefined),
		{
			type: "ai_span",
			spanName: input.spanName,
		},
	);
}
