import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { applyWorkspaceEventToCache } from "#/features/workspaces/cache";
import type {
	CreateWorkspaceItemInput,
	DeleteWorkspaceItemInput,
	MoveWorkspaceItemInput,
	RenameWorkspaceItemInput,
	WriteWorkspaceItemInput,
} from "#/features/workspaces/contracts";
import {
	createWorkspaceItemFn,
	deleteWorkspaceItemFn,
	moveWorkspaceItemFn,
	renameWorkspaceItemFn,
	writeWorkspaceItemFn,
} from "#/features/workspaces/server/functions";
import { useWorkspaceClientMutationEcho } from "#/features/workspaces/use-workspace-client-mutation-echo";
import { getErrorMessage } from "#/lib/error-message";

export function useCreateWorkspaceItemMutation() {
	const createWorkspaceItem = useServerFn(createWorkspaceItemFn);
	const queryClient = useQueryClient();
	const mutationEcho =
		useWorkspaceClientMutationEcho<CreateWorkspaceItemInput>();

	return useMutation({
		mutationFn: (input: CreateWorkspaceItemInput) => {
			const inputWithClientMutation = withClientMutationId(input, mutationEcho);
			return createWorkspaceItem({ data: inputWithClientMutation });
		},
		onSuccess: (command) => {
			applyWorkspaceEventToCache(queryClient, command.event);
		},
		onError: (error) => {
			toast.error(
				getErrorMessage(error, "Unable to create workspace item right now."),
			);
		},
	});
}

export function useWriteWorkspaceItemContentMutation() {
	const writeWorkspaceItem = useServerFn(writeWorkspaceItemFn);
	const queryClient = useQueryClient();
	const mutationEcho =
		useWorkspaceClientMutationEcho<WriteWorkspaceItemInput>();

	return useMutation({
		mutationFn: (input: WriteWorkspaceItemInput) => {
			const inputWithClientMutation = withClientMutationId(input, mutationEcho);
			return writeWorkspaceItem({ data: inputWithClientMutation });
		},
		onSuccess: (command, input) => {
			applyWorkspaceEventToCache(queryClient, command.event, {
				content: input.content,
			});
		},
		onError: (error) => {
			toast.error(
				getErrorMessage(error, "Unable to save workspace item right now."),
			);
		},
	});
}

export function useRenameWorkspaceItemMutation() {
	const renameWorkspaceItem = useServerFn(renameWorkspaceItemFn);
	const queryClient = useQueryClient();
	const mutationEcho =
		useWorkspaceClientMutationEcho<RenameWorkspaceItemInput>();

	return useMutation({
		mutationFn: (input: RenameWorkspaceItemInput) => {
			const inputWithClientMutation = withClientMutationId(input, mutationEcho);
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
	const mutationEcho = useWorkspaceClientMutationEcho<MoveWorkspaceItemInput>();

	return useMutation({
		mutationFn: (input: MoveWorkspaceItemInput) => {
			const inputWithClientMutation = withClientMutationId(input, mutationEcho);
			return moveWorkspaceItem({ data: inputWithClientMutation });
		},
		onSuccess: (command) => {
			applyWorkspaceEventToCache(queryClient, command.event);
		},
		onError: (error) => {
			toast.error(
				getErrorMessage(error, "Unable to move workspace item right now."),
			);
		},
	});
}

export function useDeleteWorkspaceItemMutation() {
	const deleteWorkspaceItem = useServerFn(deleteWorkspaceItemFn);
	const queryClient = useQueryClient();
	const mutationEcho =
		useWorkspaceClientMutationEcho<DeleteWorkspaceItemInput>();

	return useMutation({
		mutationFn: (input: DeleteWorkspaceItemInput) => {
			const inputWithClientMutation = withClientMutationId(input, mutationEcho);
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

function withClientMutationId<TInput extends { clientMutationId?: string }>(
	input: TInput,
	mutationEcho: ReturnType<typeof useWorkspaceClientMutationEcho<TInput>>,
) {
	const clientMutationId = mutationEcho.getClientMutationId(input);
	mutationEcho.trackClientMutationId(input, clientMutationId);

	return {
		...input,
		clientMutationId,
	};
}
