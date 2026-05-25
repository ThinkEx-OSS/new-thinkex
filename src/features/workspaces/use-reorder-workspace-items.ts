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
import { debugWorkspaceDnd } from "#/features/workspaces/model/drag";
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
			const scopeKey = getWorkspaceItemOrderScopeKey(input);
			const clientMutationId = clientMutationEcho.getClientMutationId(input);

			debugWorkspaceDnd("reorder:request", {
				scopeKey,
				clientMutationId,
				row: input.row,
				parentId: input.parentId,
				movedItemId: input.movedItemId,
				orderedItemIds: input.orderedItemIds,
			});

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

			debugWorkspaceDnd("reorder:onMutate:start", {
				scopeKey,
				sequence,
				clientMutationId,
				row: input.row,
				parentId: input.parentId,
				movedItemId: input.movedItemId,
				orderedItemIds: input.orderedItemIds,
			});

			return {
				scopeKey,
				sequence,
				clientMutationId,
			};
		},
		onSuccess: (result: ReorderWorkspaceItemsResult, _input, context) => {
			if (!isLatestReorder(context)) {
				debugWorkspaceDnd("reorder:onSuccess:stale", {
					scopeKey: context?.scopeKey,
					sequence: context?.sequence,
					clientMutationId: context?.clientMutationId,
					resultItemIds: result.items.map((item) => item.id),
				});
				return;
			}

			applyWorkspaceItemReorderInCaches(queryClient, result);
			debugWorkspaceDnd("reorder:onSuccess:applied", {
				scopeKey: context?.scopeKey,
				sequence: context?.sequence,
				clientMutationId: context?.clientMutationId,
				resultItemIds: result.items.map((item) => item.id),
			});
		},
		onError: (error, input, context) => {
			if (!isLatestReorder(context)) {
				debugWorkspaceDnd("reorder:onError:stale", {
					scopeKey: context?.scopeKey,
					sequence: context?.sequence,
					clientMutationId: context?.clientMutationId,
					error: getErrorMessage(error, "Unable to reorder items right now."),
				});
				return;
			}

			toast.error(getErrorMessage(error, "Unable to reorder items right now."));
			debugWorkspaceDnd("reorder:onError", {
				scopeKey: context?.scopeKey,
				sequence: context?.sequence,
				clientMutationId: context?.clientMutationId,
				error: getErrorMessage(error, "Unable to reorder items right now."),
				orderedItemIds: input.orderedItemIds,
			});

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

			debugWorkspaceDnd("reorder:onSettled", {
				scopeKey: context.scopeKey,
				sequence: context.sequence,
				clientMutationId: context.clientMutationId,
				hasError: Boolean(_error),
			});

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
