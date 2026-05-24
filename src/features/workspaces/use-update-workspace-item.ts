import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
	upsertWorkspaceItemInCaches,
	workspaceItemsQueryKey,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import type {
	UpdateWorkspaceItemInput,
	WorkspaceItemSummary,
	WorkspacePage,
} from "#/features/workspaces/contracts";
import { updateWorkspaceItemFn } from "#/features/workspaces/server/functions";
import { getErrorMessage } from "#/lib/error-message";

type UpdateWorkspaceItemVariables = UpdateWorkspaceItemInput & {
	item: WorkspaceItemSummary;
};

export function useUpdateWorkspaceItemMutation() {
	const updateWorkspaceItem = useServerFn(updateWorkspaceItemFn);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ item: _item, ...input }: UpdateWorkspaceItemVariables) =>
			updateWorkspaceItem({ data: input }),
		onMutate: async (input) => {
			await Promise.all([
				queryClient.cancelQueries({
					queryKey: workspaceItemsQueryKey(input.workspaceId),
				}),
				queryClient.cancelQueries({
					queryKey: workspacePageQueryKey(input.workspaceId),
				}),
			]);

			const previousItems = queryClient.getQueryData<WorkspaceItemSummary[]>(
				workspaceItemsQueryKey(input.workspaceId),
			);
			const previousPage = queryClient.getQueryData<WorkspacePage>(
				workspacePageQueryKey(input.workspaceId),
			);
			const name = input.name.trim();

			upsertWorkspaceItemInCaches(queryClient, {
				...input.item,
				name,
				title: name,
				updatedAt: new Date().toISOString(),
			});

			return {
				previousItems,
				previousPage,
			};
		},
		onSuccess: (item) => {
			upsertWorkspaceItemInCaches(queryClient, item);
		},
		onError: (error, input, context) => {
			if (context?.previousItems) {
				queryClient.setQueryData(
					workspaceItemsQueryKey(input.workspaceId),
					context.previousItems,
				);
			}

			if (context?.previousPage) {
				queryClient.setQueryData(
					workspacePageQueryKey(input.workspaceId),
					context.previousPage,
				);
			}

			toast.error(getErrorMessage(error, "Unable to rename item right now."));
		},
	});
}
