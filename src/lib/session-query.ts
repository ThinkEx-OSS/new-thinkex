import { type QueryClient, queryOptions } from "@tanstack/react-query";

import { type AuthSession, getSession } from "#/lib/auth.functions";

export const authSessionQueryKey = ["auth", "session"] as const;
export type { AuthSession };

export function getAuthSessionQueryOptions() {
	return queryOptions({
		queryKey: authSessionQueryKey,
		queryFn: () => getSession(),
		staleTime: typeof window !== "undefined" ? 2 * 60_000 : 0,
		gcTime: typeof window !== "undefined" ? 30 * 60 * 1000 : 0,
		refetchInterval: typeof window !== "undefined" ? 60_000 : false,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
		refetchOnMount: true,
		retry: 1,
	});
}

export function removeAuthSession(queryClient: QueryClient) {
	queryClient.setQueryData<AuthSession | null>(authSessionQueryKey, null);
}

export function refreshAuthSession(queryClient: QueryClient) {
	return queryClient.fetchQuery(getAuthSessionQueryOptions());
}
