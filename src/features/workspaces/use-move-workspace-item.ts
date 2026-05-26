import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef } from "react";
import { toast } from "sonner";

import {
	applyWorkspaceItemMoveInCaches,
	optimisticallyMoveWorkspaceItemInCaches,
	workspaceItemsQueryKey,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import type {
	MoveWorkspaceItemInput,
	MoveWorkspaceItemResult,
	WorkspaceItemSummary,
	WorkspacePage,
} from "#/features/workspaces/contracts";
import { moveWorkspaceItemFn } from "#/features/workspaces/server/functions";
import {
	useWorkspaceClientMutationEcho,
	WORKSPACE_LOCAL_MUTATION_ECHO_TTL_MS,
} from "#/features/workspaces/use-workspace-client-mutation-echo";
import {
	workspaceItemOrderingMutationKey,
	workspaceItemOrderingMutationScope,
} from "#/features/workspaces/workspace-item-ordering";
import { getErrorMessage } from "#/lib/error-message";

export function useMoveWorkspaceItemMutation() {
	const moveWorkspaceItem = useServerFn(moveWorkspaceItemFn);
	const queryClient = useQueryClient();
	const moveSequences = useRef(new Map<string, number>());
	const clientMutationEcho =
		useWorkspaceClientMutationEcho<MoveWorkspaceItemInput>();

	const isLatestMove = (
		context:
			| {
					itemId: string;
					sequence: number;
			  }
			| undefined,
	) =>
		Boolean(
			context && moveSequences.current.get(context.itemId) === context.sequence,
		);
	const mutation = useMutation({
		mutationKey: workspaceItemOrderingMutationKey,
		scope: workspaceItemOrderingMutationScope,
		mutationFn: (input: MoveWorkspaceItemInput) => {
			const clientMutationId = clientMutationEcho.getClientMutationId(input);

			return moveWorkspaceItem({
				data: {
					...input,
					clientMutationId,
				},
			});
		},
		onMutate: async (input) => {
			await Promise.all([
				queryClient.cancelQueries({
					queryKey: workspaceItemsQueryKey(input.workspaceId),
				}),
				queryClient.cancelQueries({
					queryKey: workspacePageQueryKey(input.workspaceId),
				}),
			]);

			const sequence = (moveSequences.current.get(input.itemId) ?? 0) + 1;
			const clientMutationId = clientMutationEcho.getClientMutationId(input);
			const previousItems = queryClient.getQueryData<WorkspaceItemSummary[]>(
				workspaceItemsQueryKey(input.workspaceId),
			);
			const previousPage = queryClient.getQueryData<WorkspacePage>(
				workspacePageQueryKey(input.workspaceId),
			);

			clientMutationEcho.trackClientMutationId(input, clientMutationId);
			moveSequences.current.set(input.itemId, sequence);

			optimisticallyMoveWorkspaceItemInCaches(queryClient, input);

			return {
				itemId: input.itemId,
				sequence,
				clientMutationId,
				previousItems,
				previousPage,
			};
		},
		onSuccess: (result: MoveWorkspaceItemResult, _input, context) => {
			if (!isLatestMove(context)) {
				return;
			}

			applyWorkspaceItemMoveInCaches(queryClient, result);
		},
		onError: (error, input, context) => {
			if (!isLatestMove(context)) {
				return;
			}

			if (
				context?.previousItems &&
				queryClient.isMutating({
					mutationKey: workspaceItemOrderingMutationKey,
				}) === 1
			) {
				queryClient.setQueryData(
					workspaceItemsQueryKey(input.workspaceId),
					context.previousItems,
				);

				if (context.previousPage) {
					queryClient.setQueryData(
						workspacePageQueryKey(input.workspaceId),
						context.previousPage,
					);
				}
			}
			toast.error(getErrorMessage(error, "Unable to move item right now."));
		},
		onSettled: (_result, _error, _input, context) => {
			if (!context) {
				return;
			}

			setTimeout(() => {
				clientMutationEcho.forgetClientMutationId(context.clientMutationId);
			}, WORKSPACE_LOCAL_MUTATION_ECHO_TTL_MS);

			if (_error) {
				setTimeout(() => {
					if (
						queryClient.isMutating({
							mutationKey: workspaceItemOrderingMutationKey,
						}) === 0
					) {
						void Promise.all([
							queryClient.invalidateQueries({
								queryKey: workspaceItemsQueryKey(_input.workspaceId),
							}),
							queryClient.invalidateQueries({
								queryKey: workspacePageQueryKey(_input.workspaceId),
							}),
						]);
					}
				}, 0);
			}
		},
	});

	return {
		...mutation,
		shouldIgnoreMoveEvent: clientMutationEcho.shouldIgnoreLocalEcho,
	};
}
