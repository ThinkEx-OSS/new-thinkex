import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { toast } from "sonner";

import {
	applyWorkspaceEventToCache,
	createWorkspaceItemInPageCache,
	getWorkspaceItemColorInPageCache,
	moveWorkspaceItemInPageCache,
	removeWorkspaceItemsFromPageCache,
	restoreWorkspaceItemInPageCache,
	updateWorkspaceItemColorInPageCache,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import type {
	CreateWorkspaceItemInput,
	DeleteWorkspaceItemsInput,
	MoveWorkspaceItemInput,
	RenameWorkspaceItemInput,
	UpdateWorkspaceItemColorInput,
	WorkspaceItemSummary,
} from "#/features/workspaces/contracts";
import type { WorkspaceCommandResult } from "#/features/workspaces/realtime/messages";
import {
	createWorkspaceItemFn,
	deleteWorkspaceItemsFn,
	moveWorkspaceItemFn,
	renameWorkspaceItemFn,
	updateWorkspaceItemColorFn,
} from "#/features/workspaces/server/functions";
import { prepareWorkspaceClientMutationInput } from "#/features/workspaces/use-workspace-client-mutation-echo";
import { apiErrorSchema } from "#/lib/api/contracts";
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

export function useUploadWorkspaceFileMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: {
			workspaceId: string;
			parentId: string | null;
			file: File;
			clientMutationId?: string;
		}) => {
			const inputWithClientMutation =
				prepareWorkspaceClientMutationInput(input);
			const formData = new FormData();

			formData.set("file", inputWithClientMutation.file);
			formData.set(
				"clientMutationId",
				inputWithClientMutation.clientMutationId,
			);

			if (inputWithClientMutation.parentId) {
				formData.set("parentId", inputWithClientMutation.parentId);
			}

			const uploadPromise = fetch(
				`/api/v1/workspaces/${inputWithClientMutation.workspaceId}/file-upload`,
				{
					method: "POST",
					body: formData,
				},
			).then(async (uploadResponse) => {
				if (!uploadResponse.ok) {
					throw new Error(await getUploadErrorMessage(uploadResponse));
				}

				return (await uploadResponse.json()) as WorkspaceCommandResult<WorkspaceItemSummary>;
			});

			void toast.promise(uploadPromise, {
				loading: `Uploading ${input.file.name}...`,
				success: `Uploaded ${input.file.name}.`,
				error: (error) =>
					getErrorMessage(error, "Unable to upload file right now."),
			});

			return uploadPromise;
		},
		onSuccess: (command) => {
			applyWorkspaceEventToCache(queryClient, command.event);
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

async function getUploadErrorMessage(response: Response) {
	const fallback = "Unable to upload file to workspace storage.";

	try {
		const payload = apiErrorSchema.safeParse(await response.json());

		return payload.success ? payload.data.message : fallback;
	} catch {
		return fallback;
	}
}

function getWorkspaceItemColorCommitKey(input: UpdateWorkspaceItemColorInput) {
	return `${input.workspaceId}:${input.itemId}`;
}
