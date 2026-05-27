import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
	applyWorkspaceEventToCache,
	createWorkspaceItemInPageCache,
	moveWorkspaceItemInPageCache,
	removeWorkspaceItemsFromPageCache,
	restoreWorkspaceItemInPageCache,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import type {
	CreateWorkspaceItemInput,
	DeleteWorkspaceItemInput,
	MoveWorkspaceItemInput,
	RenameWorkspaceItemInput,
} from "#/features/workspaces/contracts";
import {
	createWorkspaceItemFn,
	deleteWorkspaceItemFn,
	moveWorkspaceItemFn,
	renameWorkspaceItemFn,
} from "#/features/workspaces/server/functions";
import { prepareWorkspaceClientMutationInput } from "#/features/workspaces/use-workspace-client-mutation-echo";
import { getErrorMessage } from "#/lib/error-message";

export function useCreateWorkspaceItemMutation() {
	const createWorkspaceItem = useServerFn(createWorkspaceItemFn);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CreateWorkspaceItemInput) => {
			const inputWithClientMutation =
				prepareWorkspaceClientMutationInput(input);
			return createWorkspaceItem({ data: inputWithClientMutation });
		},
		onMutate: async (input) => {
			await queryClient.cancelQueries({
				queryKey: workspacePageQueryKey(input.workspaceId),
			});

			if (input.id) {
				createWorkspaceItemInPageCache(queryClient, {
					...input,
					id: input.id,
				});
			}
		},
		onSuccess: (command) => {
			applyWorkspaceEventToCache(queryClient, command.event);
		},
		onError: (error, input) => {
			if (input.id) {
				removeWorkspaceItemsFromPageCache(queryClient, input.workspaceId, [
					input.id,
				]);
			}
			toast.error(
				getErrorMessage(error, "Unable to create workspace item right now."),
			);
		},
	});
}

export function useRenameWorkspaceItemMutation() {
	const renameWorkspaceItem = useServerFn(renameWorkspaceItemFn);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: RenameWorkspaceItemInput) => {
			const inputWithClientMutation =
				prepareWorkspaceClientMutationInput(input);
			return renameWorkspaceItem({ data: inputWithClientMutation });
		},
		onSuccess: (command) => {
			applyWorkspaceEventToCache(queryClient, command.event);
		},
		onError: (error) => {
			toast.error(
				getErrorMessage(error, "Unable to rename workspace item right now."),
			);
		},
	});
}

export function useMoveWorkspaceItemMutation() {
	const moveWorkspaceItem = useServerFn(moveWorkspaceItemFn);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: MoveWorkspaceItemInput) => {
			const inputWithClientMutation =
				prepareWorkspaceClientMutationInput(input);
			return moveWorkspaceItem({ data: inputWithClientMutation });
		},
		onMutate: async (input) => {
			await queryClient.cancelQueries({
				queryKey: workspacePageQueryKey(input.workspaceId),
			});

			return {
				previousItem: moveWorkspaceItemInPageCache(queryClient, input),
			};
		},
		onSuccess: (command) => {
			applyWorkspaceEventToCache(queryClient, command.event);
		},
		onError: (error, _input, context) => {
			restoreWorkspaceItemInPageCache(queryClient, context?.previousItem);
			toast.error(
				getErrorMessage(error, "Unable to move workspace item right now."),
			);
		},
	});
}

export function useDeleteWorkspaceItemMutation() {
	const deleteWorkspaceItem = useServerFn(deleteWorkspaceItemFn);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: DeleteWorkspaceItemInput) => {
			const inputWithClientMutation =
				prepareWorkspaceClientMutationInput(input);
			return deleteWorkspaceItem({ data: inputWithClientMutation });
		},
		onSuccess: (command) => {
			applyWorkspaceEventToCache(queryClient, command.event);
		},
		onError: (error) => {
			toast.error(
				getErrorMessage(error, "Unable to delete workspace item right now."),
			);
		},
	});
}
