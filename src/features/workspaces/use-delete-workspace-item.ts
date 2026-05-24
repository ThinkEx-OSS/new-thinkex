import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
	applyWorkspaceItemDeletionInCaches,
	workspaceItemsQueryKey,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import type {
	DeleteWorkspaceItemInput,
	DeleteWorkspaceItemResult,
	WorkspaceItemSummary,
	WorkspacePage,
} from "#/features/workspaces/contracts";
import { deleteWorkspaceItemFn } from "#/features/workspaces/server/functions";
import { getErrorMessage } from "#/lib/error-message";

type DeleteWorkspaceItemVariables = DeleteWorkspaceItemInput & {
	optimisticDeletedItemIds: string[];
	optimisticReparentedItems?: WorkspaceItemSummary[];
};

export function useDeleteWorkspaceItemMutation() {
	const deleteWorkspaceItem = useServerFn(deleteWorkspaceItemFn);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			optimisticDeletedItemIds: _optimisticDeletedItemIds,
			optimisticReparentedItems: _optimisticReparentedItems,
			...input
		}: DeleteWorkspaceItemVariables) => deleteWorkspaceItem({ data: input }),
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

			applyWorkspaceItemDeletionInCaches(queryClient, {
				workspaceId: input.workspaceId,
				deletedItemIds: input.optimisticDeletedItemIds,
				reparentedItems: input.optimisticReparentedItems ?? [],
			});

			return {
				previousItems,
				previousPage,
			};
		},
		onSuccess: (result: DeleteWorkspaceItemResult) => {
			applyWorkspaceItemDeletionInCaches(queryClient, result);
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

			toast.error(getErrorMessage(error, "Unable to delete item right now."));
		},
	});
}
