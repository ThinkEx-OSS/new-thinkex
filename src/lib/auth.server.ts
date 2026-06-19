import { env as workerEnv } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import * as schema from "#/db/schema";
import { createDbContext } from "#/db/server";
import { getAppOrigin, getTrustedAppOrigins } from "#/lib/app-origin";

const isProduction = import.meta.env.PROD;

type AuthEnvKey =
	| "BETTER_AUTH_SECRET"
	| "GOOGLE_CLIENT_ID"
	| "GOOGLE_CLIENT_SECRET";

type AuthRuntimeEnv = Record<AuthEnvKey, string | undefined>;

function getEnvString(name: AuthEnvKey) {
	const value = workerEnv[name];
	return value?.trim() || undefined;
}

function getAuthRuntimeEnv(): AuthRuntimeEnv {
	return {
		BETTER_AUTH_SECRET: getEnvString("BETTER_AUTH_SECRET"),
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

function createAuth(
	database: Awaited<ReturnType<typeof createDbContext>>["db"],
	env: AuthRuntimeEnv,
) {
	const baseURL = getAppOrigin();

	return betterAuth({
		database: drizzleAdapter(database, {
			provider: "pg",
			schema,
		}),
		secret: getAuthSecret(env),
		baseURL,
		trustedOrigins: getTrustedAppOrigins(baseURL),
		session: {
			expiresIn: 60 * 60 * 24 * 90,
			updateAge: 60 * 60 * 24,
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
