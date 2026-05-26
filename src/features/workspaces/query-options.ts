import { queryOptions } from "@tanstack/react-query";

import {
	workspaceItemContentQueryKey,
	workspacePageQueryKey,
	workspaceQueryKey,
	workspacesQueryKey,
} from "#/features/workspaces/cache";
import {
	getWorkspaceFn,
	getWorkspacePageFn,
	listWorkspacesFn,
	readWorkspaceItemFn,
} from "#/features/workspaces/server/functions";

export {
	workspaceItemContentQueryKey,
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

export function workspaceItemContentQueryOptions(input: {
	workspaceId: string;
	itemId: string;
}) {
	return queryOptions({
		queryKey: workspaceItemContentQueryKey(input.workspaceId, input.itemId),
		queryFn: () => readWorkspaceItemFn({ data: input }),
		staleTime: 5_000,
	});
}
