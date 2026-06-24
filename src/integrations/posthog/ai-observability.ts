import { waitUntil } from "cloudflare:workers";
import { captureAiGeneration, type CaptureAiGenerationOptions } from "@posthog/ai";

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

export function capturePostHogAiGeneration(
	options: CaptureAiGenerationOptions & {
		distinctId: string;
		sessionId?: string;
		spanName?: string;
		parentId?: string;
		spanId?: string;
	},
) {
	if (!isPostHogAiObservabilityEnabled) {
		return;
	}

	const client = getPostHogServerClient();
	if (!client) {
		return;
	}

	const properties: Record<string, unknown> = {
		...options.properties,
	};

	if (options.sessionId) {
		properties.$ai_session_id = options.sessionId;
	}

	if (options.spanName) {
		properties.$ai_span_name = options.spanName;
	}

	if (options.parentId) {
		properties.$ai_parent_id = options.parentId;
	}

	if (options.spanId) {
		properties.$ai_span_id = options.spanId;
	}

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
	if (!isPostHogAiObservabilityEnabled) {
		return;
	}

	const client = getPostHogServerClient();
	if (!client) {
		return;
	}

	const properties: Record<string, unknown> = {
		$ai_trace_id: input.traceId,
		$ai_session_id: input.sessionId,
		$ai_span_id: input.spanId,
		$ai_span_name: input.spanName,
		...input.properties,
	};

	if (input.parentId) {
		properties.$ai_parent_id = input.parentId;
	}

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
