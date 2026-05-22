import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import * as schema from "#/db/schema";
import { createDbContext } from "#/db/server";

const DEFAULT_DEV_AUTH_URL = "http://localhost:3000";

function getAuthSecret() {
	const secret = process.env.BETTER_AUTH_SECRET?.trim();

	if (!secret) {
		throw new Error(
			"BETTER_AUTH_SECRET is not configured. Set it before enabling authentication.",
		);
	}

	return secret;
}

function getAuthUrl() {
	return process.env.BETTER_AUTH_URL?.trim() || DEFAULT_DEV_AUTH_URL;
}

function createAuth(
	database: Awaited<ReturnType<typeof createDbContext>>["db"],
) {
	return betterAuth({
		database: drizzleAdapter(database, {
			provider: "pg",
			schema,
		}),
		secret: getAuthSecret(),
		baseURL: getAuthUrl(),
		session: {
			cookieCache: {
				enabled: true,
				maxAge: 5 * 60,
			},
		},
		socialProviders: {
			google: {
				clientId: process.env.GOOGLE_CLIENT_ID || "",
				clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
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
	const auth = createAuth(dbContext.db);

	try {
		return await run(auth);
	} finally {
		await dbContext.dispose();
	}
}
