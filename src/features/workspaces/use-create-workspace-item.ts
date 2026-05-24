import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
	removeWorkspaceItemFromCaches,
	upsertWorkspaceItemInCaches,
	workspaceItemsQueryKey,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import type {
	CreateWorkspaceItemInput,
	WorkspaceItemSummary,
	WorkspacePage,
} from "#/features/workspaces/contracts";
import { getAvailableWorkspaceItemName } from "#/features/workspaces/defaults";
import { getWorkspaceItemTypeDisplay } from "#/features/workspaces/model/item-display";
import { createWorkspaceItemFn } from "#/features/workspaces/server/functions";
import { getErrorMessage } from "#/lib/error-message";

type CreateWorkspaceItemVariables = Omit<
	CreateWorkspaceItemInput,
	"id" | "name"
> & {
	id: NonNullable<CreateWorkspaceItemInput["id"]>;
	name: string;
};

export function useCreateWorkspaceItemMutation() {
	const createWorkspaceItem = useServerFn(createWorkspaceItemFn);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CreateWorkspaceItemVariables) =>
			createWorkspaceItem({ data: input }),
		onMutate: async (input) => {
			await Promise.all([
				queryClient.cancelQueries({
					queryKey: workspaceItemsQueryKey(input.workspaceId),
				}),
				queryClient.cancelQueries({
					queryKey: workspacePageQueryKey(input.workspaceId),
				}),
			]);

			const optimisticItem = createOptimisticWorkspaceItem(input);
			const previousItems = queryClient.getQueryData<WorkspaceItemSummary[]>(
				workspaceItemsQueryKey(input.workspaceId),
			);
			const previousPage = queryClient.getQueryData<WorkspacePage>(
				workspacePageQueryKey(input.workspaceId),
			);

			upsertWorkspaceItemInCaches(queryClient, optimisticItem);

			return {
				item: optimisticItem,
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
			} else {
				removeWorkspaceItemFromCaches(queryClient, {
					workspaceId: input.workspaceId,
					itemId: input.id,
				});
			}

			if (context?.previousPage) {
				queryClient.setQueryData(
					workspacePageQueryKey(input.workspaceId),
					context.previousPage,
				);
			}

			toast.error(getErrorMessage(error, "Unable to create item right now."));
		},
	});
}

export function createWorkspaceItemMutationInput(
	input: Omit<CreateWorkspaceItemInput, "id"> & {
		existingItems?: WorkspaceItemSummary[];
	},
): CreateWorkspaceItemVariables {
	const name =
		input.name?.trim() ||
		getAvailableWorkspaceItemName({
			type: input.type,
			requestedName: input.name,
			existingNames:
				input.existingItems
					?.filter((item) => item.parentId === (input.parentId ?? null))
					.map((item) => item.name) ?? [],
		});

	return {
		workspaceId: input.workspaceId,
		parentId: input.parentId,
		type: input.type,
		name,
		id: crypto.randomUUID() as NonNullable<CreateWorkspaceItemInput["id"]>,
	};
}

function createOptimisticWorkspaceItem(
	input: CreateWorkspaceItemVariables,
): WorkspaceItemSummary {
	const now = new Date().toISOString();
	const name = input.name.trim();

	return {
		id: input.id,
		workspaceId: input.workspaceId,
		parentId: input.parentId ?? null,
		type: input.type,
		title: name,
		name,
		meta: getWorkspaceItemTypeDisplay(input.type).label,
		color: null,
		metadataJson: {},
		sortOrder: Date.now(),
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
	};
}
