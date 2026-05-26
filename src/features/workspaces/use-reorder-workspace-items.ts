import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef } from "react";
import { toast } from "sonner";

import {
	applyWorkspaceItemReorderInCaches,
	workspaceItemsQueryKey,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import type {
	ReorderWorkspaceItemsInput,
	ReorderWorkspaceItemsResult,
} from "#/features/workspaces/contracts";
import { reorderWorkspaceItemsFn } from "#/features/workspaces/server/functions";
import {
	useWorkspaceClientMutationEcho,
	WORKSPACE_LOCAL_MUTATION_ECHO_TTL_MS,
} from "#/features/workspaces/use-workspace-client-mutation-echo";
import {
	getWorkspaceItemOrderScopeKey,
	workspaceItemOrderingMutationKey,
	workspaceItemOrderingMutationScope,
} from "#/features/workspaces/workspace-item-ordering";
import { getErrorMessage } from "#/lib/error-message";

export function useReorderWorkspaceItemsMutation() {
	const reorderWorkspaceItems = useServerFn(reorderWorkspaceItemsFn);
	const queryClient = useQueryClient();
	const reorderSequences = useRef(new Map<string, number>());
	const clientMutationEcho =
		useWorkspaceClientMutationEcho<ReorderWorkspaceItemsInput>();

	const isLatestReorder = (
		context:
			| {
					scopeKey: string;
					sequence: number;
			  }
			| undefined,
	) =>
		Boolean(
			context &&
				reorderSequences.current.get(context.scopeKey) === context.sequence,
		);
	const mutation = useMutation({
		mutationKey: workspaceItemOrderingMutationKey,
		scope: workspaceItemOrderingMutationScope,
		mutationFn: (input: ReorderWorkspaceItemsInput) => {
			const clientMutationId = clientMutationEcho.getClientMutationId(input);

			return reorderWorkspaceItems({
				data: {
					...input,
					clientMutationId,
				},
			});
		},
		onMutate: (input) => {
			const scopeKey = getWorkspaceItemOrderScopeKey(input);
			const sequence = (reorderSequences.current.get(scopeKey) ?? 0) + 1;
			const clientMutationId = clientMutationEcho.getClientMutationId(input);

			clientMutationEcho.trackClientMutationId(input, clientMutationId);
			reorderSequences.current.set(scopeKey, sequence);

			return {
				scopeKey,
				sequence,
				clientMutationId,
			};
		},
		onSuccess: (result: ReorderWorkspaceItemsResult, _input, context) => {
			if (!isLatestReorder(context)) {
				return;
			}

			applyWorkspaceItemReorderInCaches(queryClient, result);
		},
		onError: (error, input, context) => {
			if (!isLatestReorder(context)) {
				return;
			}

			toast.error(getErrorMessage(error, "Unable to reorder items right now."));

			if (
				queryClient.isMutating({
					mutationKey: workspaceItemOrderingMutationKey,
				}) === 1
			) {
				void Promise.all([
					queryClient.invalidateQueries({
						queryKey: workspaceItemsQueryKey(input.workspaceId),
					}),
					queryClient.invalidateQueries({
						queryKey: workspacePageQueryKey(input.workspaceId),
					}),
				]);
			}
		},
		onSettled: (_result, _error, _input, context) => {
			if (!context) {
				return;
			}

			setTimeout(() => {
				clientMutationEcho.forgetClientMutationId(context.clientMutationId);
			}, WORKSPACE_LOCAL_MUTATION_ECHO_TTL_MS);
		},
	});

	return {
		...mutation,
		shouldIgnoreReorderEvent: clientMutationEcho.shouldIgnoreLocalEcho,
	};
}
