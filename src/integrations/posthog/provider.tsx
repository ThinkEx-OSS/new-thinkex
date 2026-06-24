import { PostHogProvider as PostHogReactProvider } from "@posthog/react";
import { useQuery } from "@tanstack/react-query";
import posthog from "posthog-js";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import type { AuthSession } from "#/lib/session-query";
import { getAuthSessionQueryOptions } from "#/lib/session-query";

const posthogProjectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim();
const posthogHost = import.meta.env.VITE_POSTHOG_HOST?.trim();
const posthogUiHost = "https://us.posthog.com";
const isPostHogEnabled = Boolean(posthogProjectToken && posthogHost);

let isPostHogInitialized = false;

if (typeof window !== "undefined" && isPostHogEnabled && !isPostHogInitialized) {
	posthog.init(posthogProjectToken, {
		api_host: posthogHost,
		ui_host: posthogUiHost,
		defaults: "2026-05-30",
	});

	isPostHogInitialized = true;
}

export function capturePostHogClientEvent(event: string, properties?: Record<string, unknown>) {
	if (!isPostHogEnabled) {
		return;
	}

	posthog.capture(event, properties);
}

type AuthenticatedSession = NonNullable<AuthSession>;

function identifyPostHogUser(session: AuthenticatedSession) {
	if (!isPostHogEnabled) {
		return;
	}

	posthog.identify(session.user.id, {
		email: session.user.email,
		name: session.user.name,
	});
}

function PostHogAuthSync() {
	const { data: session, isPending } = useQuery(getAuthSessionQueryOptions());
	const lastDistinctIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (!isPostHogEnabled || isPending) {
			return;
		}

		if (session?.user) {
			identifyPostHogUser(session);
			lastDistinctIdRef.current = session.user.id;
			return;
		}

		if (lastDistinctIdRef.current) {
			posthog.reset();
			lastDistinctIdRef.current = null;
		}
	}, [isPending, session]);

	return null;
}

export default function PostHogProvider({ children }: { children: ReactNode }) {
	if (!isPostHogEnabled) {
		return children;
	}

	return (
		<PostHogReactProvider client={posthog}>
			<PostHogAuthSync />
			{children}
		</PostHogReactProvider>
	);
}
