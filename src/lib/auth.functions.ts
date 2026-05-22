import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

export async function getSessionFromHeaders(headers: Headers) {
	const { getSessionFromHeaders: getServerSessionFromHeaders } = await import(
		"#/lib/auth-queries.server"
	);

	return getServerSessionFromHeaders(headers);
}

export async function getSessionFromRequest(request: Request) {
	return getSessionFromHeaders(new Headers(request.headers));
}

export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		return getSessionFromHeaders(getRequestHeaders());
	},
);

export type AuthSession = Awaited<ReturnType<typeof getSession>>;

export const ensureSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await getSessionFromHeaders(getRequestHeaders());

		if (!session) {
			throw new Error("Unauthorized");
		}

		return session;
	},
);
