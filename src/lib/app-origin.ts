import { env as workerEnv } from "cloudflare:workers";

import { buildInvitePath } from "#/lib/client-url";

const LOCAL_TRUSTED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"] as const;

const isProduction = import.meta.env.PROD;

export function normalizeAppOrigin(value: string, envName: string) {
	try {
		const url = new URL(value);

		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new Error("App URLs must use http or https.");
		}

		return url.origin;
	} catch (error) {
		throw new Error(`${envName} must be a valid absolute http(s) URL.`, {
			cause: error,
		});
	}
}

export function getAppOrigin() {
	const configuredUrl = workerEnv.BETTER_AUTH_URL?.trim();

	if (configuredUrl) {
		const origin = normalizeAppOrigin(configuredUrl, "BETTER_AUTH_URL");

		if (isProduction && !origin.startsWith("https://")) {
			throw new Error("BETTER_AUTH_URL must use https in production.");
		}

		return origin;
	}

	if (isProduction) {
		throw new Error("BETTER_AUTH_URL must be configured in production.");
	}

	throw new Error("BETTER_AUTH_URL is not configured.");
}

export function getTrustedAppOrigins(appOrigin: string) {
	return Array.from(new Set([appOrigin, ...(isProduction ? [] : LOCAL_TRUSTED_ORIGINS)]));
}

export function buildInviteUrl(token: string, appOrigin = getAppOrigin()) {
	return `${appOrigin}${buildInvitePath(token)}`;
}
