import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const { getSessionFromHeaders } = await import("#/lib/auth-queries.server");

		return getSessionFromHeaders(getRequestHeaders());
	},
);

export type AuthSession = Awaited<ReturnType<typeof getSession>>;

export const ensureSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const { getSessionFromHeaders } = await import("#/lib/auth-queries.server");
		const session = await getSessionFromHeaders(getRequestHeaders());

		if (!session) {
			throw new Error("Unauthorized");
		}

		return session;
	},
);
