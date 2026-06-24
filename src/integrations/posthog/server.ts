import { waitUntil } from "cloudflare:workers";
import { PostHog } from "posthog-node";

import { isPostHogEnabled, posthogHost, posthogProjectToken } from "#/integrations/posthog/config";
import type {
	PostHogEventPropertiesByName,
	PostHogServerEventName,
} from "#/integrations/posthog/events";
import {
	getTelemetryRequestContext,
	type TelemetryRequestDetails,
} from "#/integrations/posthog/server-context";

const posthogServerClient =
	posthogProjectToken && posthogHost
		? new PostHog(posthogProjectToken, {
				host: posthogHost,
			})
		: null;

interface PostHogServerEvent<TEvent extends PostHogServerEventName> {
	distinctId: string;
	event: TEvent;
	properties: PostHogEventPropertiesByName[TEvent];
	timestamp?: Date | string;
}

function isPostHogServerTrackingEnabled() {
	return isPostHogEnabled && posthogServerClient !== null;
}

interface PostHogServerExceptionInput {
	distinctId?: string;
	error: unknown;
	properties?: Record<string, unknown>;
	request?: TelemetryRequestDetails;
}

function schedulePostHogTask(task: Promise<void>, context: Record<string, unknown>) {
	waitUntil(
		task.catch((error) => {
			console.error("PostHog server capture failed.", {
				...context,
				error,
			});
		}),
	);
}

export function capturePostHogServerEvent<TEvent extends PostHogServerEventName>(
	input: PostHogServerEvent<TEvent>,
) {
	if (!isPostHogServerTrackingEnabled() || !posthogServerClient) {
		return;
	}

	const requestContext = getTelemetryRequestContext();
	const timestamp =
		input.timestamp instanceof Date
			? input.timestamp
			: typeof input.timestamp === "string"
				? new Date(input.timestamp)
				: undefined;

	schedulePostHogTask(
		posthogServerClient
			.captureImmediate({
				distinctId: input.distinctId,
				event: input.event,
				properties: {
					...requestContext.properties,
					...input.properties,
				},
				...(timestamp ? { timestamp } : {}),
			})
			.then(() => undefined),
		{
			event: input.event,
			type: "event",
		},
	);
}

export function capturePostHogServerException(input: PostHogServerExceptionInput) {
	if (!isPostHogServerTrackingEnabled() || !posthogServerClient) {
		return;
	}

	const requestContext = getTelemetryRequestContext(input.request);

	schedulePostHogTask(
		posthogServerClient
			.captureExceptionImmediate(input.error, input.distinctId ?? requestContext.distinctId, {
				...requestContext.properties,
				...input.properties,
			})
			.then(() => undefined),
		{
			type: "exception",
		},
	);
}
