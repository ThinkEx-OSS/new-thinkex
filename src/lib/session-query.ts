import { type QueryClient, queryOptions } from "@tanstack/react-query";

import { getSession } from "#/lib/auth.functions";

export const authSessionQueryKey = ["auth", "session"] as const;

export type AuthSession = Awaited<ReturnType<typeof getSession>>;

/** Re-evaluates staleTime per call so server stays uncached, client can cache briefly. */
export function getAuthSessionQueryOptions() {
	return queryOptions({
		queryKey: authSessionQueryKey,
		queryFn: () => getSession(),
		staleTime: typeof window !== "undefined" ? 60_000 : 0,
		gcTime: typeof window !== "undefined" ? 30 * 60 * 1000 : 0,
	});
}

export function removeAuthSession(queryClient: QueryClient) {
	queryClient.removeQueries({ queryKey: authSessionQueryKey });
}

export function refreshAuthSession(queryClient: QueryClient) {
	return queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
}
