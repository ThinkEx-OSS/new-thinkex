import { env as workerEnv } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import * as schema from "#/db/schema";
import { createDbContext } from "#/db/server";

const LOCAL_TRUSTED_ORIGINS = [
	"http://localhost:3000",
	"http://127.0.0.1:3000",
];
const isProduction = import.meta.env.PROD;

type AuthEnvKey =
	| "BETTER_AUTH_SECRET"
	| "BETTER_AUTH_URL"
	| "GOOGLE_CLIENT_ID"
	| "GOOGLE_CLIENT_SECRET";

type AuthRuntimeEnv = Record<AuthEnvKey, string | undefined>;

function normalizeOrigin(value: string, envName: string) {
	try {
		const url = new URL(value);

		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new Error("Auth URLs must use http or https.");
		}

		return url.origin;
	} catch (error) {
		throw new Error(`${envName} must be a valid absolute http(s) URL.`, {
			cause: error,
		});
	}
}

function getEnvString(name: AuthEnvKey) {
	const value = workerEnv[name];
	return value?.trim() || undefined;
}

function getAuthRuntimeEnv(): AuthRuntimeEnv {
	return {
		BETTER_AUTH_SECRET: getEnvString("BETTER_AUTH_SECRET"),
		BETTER_AUTH_URL: getEnvString("BETTER_AUTH_URL"),
		GOOGLE_CLIENT_ID: getEnvString("GOOGLE_CLIENT_ID"),
		GOOGLE_CLIENT_SECRET: getEnvString("GOOGLE_CLIENT_SECRET"),
	};
}

function getAuthSecret(env: AuthRuntimeEnv) {
	const secret = env.BETTER_AUTH_SECRET;

	if (!secret) {
		throw new Error(
			"BETTER_AUTH_SECRET is not configured. Set it before enabling authentication.",
		);
	}

	return secret;
}

function getAuthUrl(env: AuthRuntimeEnv) {
	const configuredUrl = env.BETTER_AUTH_URL;

	if (configuredUrl) {
		const origin = normalizeOrigin(configuredUrl, "BETTER_AUTH_URL");

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

function getTrustedOrigins(authUrl: string) {
	return Array.from(
		new Set([authUrl, ...(isProduction ? [] : LOCAL_TRUSTED_ORIGINS)]),
	);
}

function createAuth(
	database: Awaited<ReturnType<typeof createDbContext>>["db"],
	env: AuthRuntimeEnv,
) {
	const baseURL = getAuthUrl(env);

	return betterAuth({
		database: drizzleAdapter(database, {
			provider: "pg",
			schema,
		}),
		secret: getAuthSecret(env),
		baseURL,
		trustedOrigins: getTrustedOrigins(baseURL),
		session: {
			cookieCache: {
				enabled: true,
				maxAge: 5 * 60,
			},
		},
		rateLimit: {
			enabled: isProduction,
			storage: "memory",
		},
		advanced: {
			ipAddress: {
				ipAddressHeaders: ["cf-connecting-ip"],
			},
		},
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID || "",
				clientSecret: env.GOOGLE_CLIENT_SECRET || "",
				prompt: "select_account",
			},
		},
		plugins: [tanstackStartCookies()],
	});
}

export async function withAuth<T>(
	run: (auth: ReturnType<typeof createAuth>) => Promise<T>,
) {
	const dbContext = await createDbContext();
	const auth = createAuth(dbContext.db, getAuthRuntimeEnv());

	try {
		return await run(auth);
	} finally {
		await dbContext.dispose();
	}
}
