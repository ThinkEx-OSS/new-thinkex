import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
	removeWorkspaceDetailCaches,
	restoreWorkspaceListCache,
	seedWorkspaceCaches,
	workspacePageQueryKey,
	workspaceQueryKey,
	workspacesQueryKey,
} from "#/features/workspaces/cache";
import type {
	CreateWorkspaceInput,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import { createOptimisticWorkspace } from "#/features/workspaces/defaults";
import { WORKSPACE_ROOT_VIEW } from "#/features/workspaces/model/tabs";
import { createWorkspaceFn } from "#/features/workspaces/server/functions";
import { getErrorMessage } from "#/lib/error-message";

interface CreateWorkspaceVariables {
	id: NonNullable<CreateWorkspaceInput["id"]>;
}

export function useCreateWorkspaceMutation() {
	const createWorkspace = useServerFn(createWorkspaceFn);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id }: CreateWorkspaceVariables) =>
			createWorkspace({ data: { id } }),
		onMutate: async ({ id }) => {
			const workspace = createOptimisticWorkspace(id);

			await Promise.all([
				queryClient.cancelQueries({ queryKey: workspacesQueryKey }),
				queryClient.cancelQueries({ queryKey: workspaceQueryKey(id) }),
				queryClient.cancelQueries({ queryKey: workspacePageQueryKey(id) }),
			]);

			const previousWorkspaces =
				queryClient.getQueryData<WorkspaceSummary[]>(workspacesQueryKey);

			seedWorkspaceCaches(queryClient, { workspace, items: [] });
			navigate({
				to: "/workspaces/$workspaceId",
				params: { workspaceId: id },
				search: { tab: undefined, view: WORKSPACE_ROOT_VIEW },
			});

			return {
				workspaceId: id,
				previousWorkspaces,
			};
		},
		onSuccess: (workspace) => {
			seedWorkspaceCaches(queryClient, { workspace, items: [] });
			toast.success("Workspace created");
		},
		onError: (error, _variables, context) => {
			restoreWorkspaceListCache(queryClient, context?.previousWorkspaces);

			if (context?.workspaceId) {
				removeWorkspaceDetailCaches(queryClient, context.workspaceId);
			}

			navigate({ to: "/home" });
			toast.error(
				getErrorMessage(error, "Unable to create workspace right now."),
			);
		},
	});
}

export function createWorkspaceMutationInput(): CreateWorkspaceVariables {
	return {
		id: crypto.randomUUID() as NonNullable<CreateWorkspaceInput["id"]>,
	};
}
