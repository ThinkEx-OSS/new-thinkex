import { queryOptions } from "@tanstack/react-query";

import {
	workspaceItemsQueryKey,
	workspacePageQueryKey,
	workspaceQueryKey,
	workspacesQueryKey,
} from "#/features/workspaces/cache";
import {
	getWorkspaceFn,
	getWorkspacePageFn,
	listWorkspaceItemsFn,
	listWorkspacesFn,
} from "#/features/workspaces/server/functions";

export {
	workspaceItemsQueryKey,
	workspacePageQueryKey,
	workspaceQueryKey,
	workspacesQueryKey,
} from "#/features/workspaces/cache";

export function workspacesQueryOptions() {
	return queryOptions({
		queryKey: workspacesQueryKey,
		queryFn: () => listWorkspacesFn(),
	});
}

export function workspaceQueryOptions(workspaceId: string) {
	return queryOptions({
		queryKey: workspaceQueryKey(workspaceId),
		queryFn: () => getWorkspaceFn({ data: { workspaceId } }),
		staleTime: 10_000,
	});
}

export function workspacePageQueryOptions(workspaceId: string) {
	return queryOptions({
		queryKey: workspacePageQueryKey(workspaceId),
		queryFn: () => getWorkspacePageFn({ data: { workspaceId } }),
		staleTime: 10_000,
	});
}

export function workspaceItemsQueryOptions(workspaceId: string) {
	return queryOptions({
		queryKey: workspaceItemsQueryKey(workspaceId),
		queryFn: () => listWorkspaceItemsFn({ data: { workspaceId } }),
		staleTime: 10_000,
	});
}
