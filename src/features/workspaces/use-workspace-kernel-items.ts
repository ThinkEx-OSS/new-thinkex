import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { toast } from "sonner";

import {
	applyWorkspaceEventToCache,
	createWorkspaceItemInPageCache,
	getWorkspaceItemColorInPageCache,
	moveWorkspaceItemsInPageCache,
	removeWorkspaceItemsFromPageCache,
	restoreWorkspaceItemsInPageCache,
	updateWorkspaceItemColorInPageCache,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import type {
	CreateWorkspaceItemInput,
	DeleteWorkspaceItemsInput,
	MoveWorkspaceItemsInput,
	RenameWorkspaceItemInput,
	UpdateWorkspaceItemColorInput,
} from "#/features/workspaces/contracts";
import {
	createWorkspaceItemFn,
	deleteWorkspaceItemsFn,
	moveWorkspaceItemsFn,
	renameWorkspaceItemFn,
	updateWorkspaceItemColorFn,
} from "#/features/workspaces/server/functions";
import { prepareWorkspaceClientMutationInput } from "#/features/workspaces/use-workspace-client-mutation-echo";
import { getErrorMessage } from "#/lib/error-message";
import { createKeyedDebouncedLatest } from "#/lib/keyed-debounced-latest";

const workspaceItemColorCommitDelayMs = 180;
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

export function useMoveWorkspaceItemsMutation() {
	const moveWorkspaceItems = useServerFn(moveWorkspaceItemsFn);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: MoveWorkspaceItemsInput) => {
			const inputWithClientMutation =
				prepareWorkspaceClientMutationInput(input);
			return moveWorkspaceItems({ data: inputWithClientMutation });
		},
		onMutate: async (input) => {
			await queryClient.cancelQueries({
				queryKey: workspacePageQueryKey(input.workspaceId),
			});

			return {
				previousItems: moveWorkspaceItemsInPageCache(queryClient, input),
			};
		},
		onSuccess: (command) => {
			applyWorkspaceEventToCache(queryClient, command.event);
		},
		onError: (_error, _input, context) => {
			restoreWorkspaceItemsInPageCache(queryClient, context?.previousItems);
		},
	});
}

export function useUpdateWorkspaceItemColorMutation() {
	const updateWorkspaceItemColor = useServerFn(updateWorkspaceItemColorFn);
	const queryClient = useQueryClient();

	const commitColor = useMemo(
		() =>
			createKeyedDebouncedLatest<UpdateWorkspaceItemColorInput>({
				getKey: getWorkspaceItemColorCommitKey,
				wait: workspaceItemColorCommitDelayMs,
				onExecute: (input) => {
					const inputWithClientMutation =
						prepareWorkspaceClientMutationInput(input);

					updateWorkspaceItemColor({ data: inputWithClientMutation }).catch(
						(error: unknown) => {
							if (
								getWorkspaceItemColorInPageCache(queryClient, input) !==
								input.color
							) {
								return;
							}

							queryClient.invalidateQueries({
								queryKey: workspacePageQueryKey(input.workspaceId),
							});
							toast.error(
								getErrorMessage(
									error,
									"Unable to update item color right now.",
								),
							);
						},
					);
				},
			}),
		[queryClient, updateWorkspaceItemColor],
	);

	const mutate = (input: UpdateWorkspaceItemColorInput) => {
		void queryClient.cancelQueries({
			queryKey: workspacePageQueryKey(input.workspaceId),
		});
		updateWorkspaceItemColorInPageCache(queryClient, input);
		commitColor(input);
	};

	return { mutate };
}

export function useDeleteWorkspaceItemsMutation() {
	const deleteWorkspaceItems = useServerFn(deleteWorkspaceItemsFn);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: DeleteWorkspaceItemsInput) => {
			const inputWithClientMutation =
				prepareWorkspaceClientMutationInput(input);
			const deletePromise = deleteWorkspaceItems({
				data: inputWithClientMutation,
			});

			void toast.promise(deletePromise, {
				loading: getDeleteWorkspaceItemsToastMessage(
					"Deleting",
					input.itemIds.length,
					"...",
				),
				success: getDeleteWorkspaceItemsToastMessage(
					"Deleted",
					input.itemIds.length,
					".",
				),
				error: (error) =>
					getErrorMessage(
						error,
						getDeleteWorkspaceItemsToastMessage(
							"Unable to delete",
							input.itemIds.length,
							" right now.",
						),
					),
			});

			return deletePromise;
		},
		onSuccess: (command) => {
			applyWorkspaceEventToCache(queryClient, command.event);
		},
	});
}

function getDeleteWorkspaceItemsToastMessage(
	action: "Deleting" | "Deleted" | "Unable to delete",
	itemCount: number,
	suffix: string,
) {
	return `${action} ${itemCount === 1 ? "item" : `${itemCount} items`}${suffix}`;
}

function getWorkspaceItemColorCommitKey(input: UpdateWorkspaceItemColorInput) {
	return `${input.workspaceId}:${input.itemId}`;
}
