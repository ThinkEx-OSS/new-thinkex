import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
	workspaceItemContentQueryKey,
	workspacePageQueryKey,
} from "#/features/workspaces/cache";
import type {
	CreateWorkspaceItemInput,
	DeleteWorkspaceItemInput,
	MoveWorkspaceItemInput,
	RenameWorkspaceItemInput,
	WorkspaceItemSummary,
	WorkspacePage,
	WriteWorkspaceItemInput,
} from "#/features/workspaces/contracts";
import {
	createWorkspaceItemFn,
	deleteWorkspaceItemFn,
	moveWorkspaceItemFn,
	renameWorkspaceItemFn,
	writeWorkspaceItemFn,
} from "#/features/workspaces/server/functions";
import { getErrorMessage } from "#/lib/error-message";

interface WorkspaceItemContentResult {
	item: WorkspaceItemSummary;
	content: string | null;
}

export function useCreateWorkspaceItemMutation() {
	const createWorkspaceItem = useServerFn(createWorkspaceItemFn);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CreateWorkspaceItemInput) =>
			createWorkspaceItem({ data: input }),
		onSuccess: (item) => {
			upsertWorkspaceItemInPageCache(queryClient, item);
			void queryClient.invalidateQueries({
				queryKey: workspacePageQueryKey(item.workspaceId),
			});
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

	return useMutation({
		mutationFn: (input: WriteWorkspaceItemInput) =>
			writeWorkspaceItem({ data: input }),
		onSuccess: (item, input) => {
			upsertWorkspaceItemInPageCache(queryClient, item);
			queryClient.setQueryData<WorkspaceItemContentResult>(
				workspaceItemContentQueryKey(input.workspaceId, input.itemId),
				{ item, content: input.content },
			);
			void queryClient.invalidateQueries({
				queryKey: workspacePageQueryKey(item.workspaceId),
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

	return useMutation({
		mutationFn: (input: RenameWorkspaceItemInput) =>
			renameWorkspaceItem({ data: input }),
		onSuccess: (item) => {
			upsertWorkspaceItemInPageCache(queryClient, item);
			void queryClient.invalidateQueries({
				queryKey: workspacePageQueryKey(item.workspaceId),
			});
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
		mutationFn: (input: MoveWorkspaceItemInput) =>
			moveWorkspaceItem({ data: input }),
		onSuccess: (item) => {
			upsertWorkspaceItemInPageCache(queryClient, item);
			void queryClient.invalidateQueries({
				queryKey: workspacePageQueryKey(item.workspaceId),
			});
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

	return useMutation({
		mutationFn: (input: DeleteWorkspaceItemInput) =>
			deleteWorkspaceItem({ data: input }),
		onSuccess: (result) => {
			removeWorkspaceItemFromPageCache(queryClient, result);
			void queryClient.invalidateQueries({
				queryKey: workspacePageQueryKey(result.workspaceId),
			});
		},
		onError: (error) => {
			toast.error(
				getErrorMessage(error, "Unable to delete workspace item right now."),
			);
		},
	});
}

function upsertWorkspaceItemInPageCache(
	queryClient: ReturnType<typeof useQueryClient>,
	item: WorkspaceItemSummary,
) {
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(item.workspaceId),
		(current) => {
			if (!current) {
				return current;
			}

			const nextItems = current.items.some(
				(candidate) => candidate.id === item.id,
			)
				? current.items.map((candidate) =>
						candidate.id === item.id ? item : candidate,
					)
				: [...current.items, item];

			return {
				...current,
				items: nextItems.sort(compareWorkspaceItems),
			};
		},
	);
}

function removeWorkspaceItemFromPageCache(
	queryClient: ReturnType<typeof useQueryClient>,
	input: { workspaceId: string; id: string },
) {
	queryClient.setQueryData<WorkspacePage>(
		workspacePageQueryKey(input.workspaceId),
		(current) => {
			if (!current) {
				return current;
			}

			const deletedIds = new Set<string>([input.id]);
			let changed = true;

			while (changed) {
				changed = false;

				for (const item of current.items) {
					if (
						item.parentId &&
						deletedIds.has(item.parentId) &&
						!deletedIds.has(item.id)
					) {
						deletedIds.add(item.id);
						changed = true;
					}
				}
			}

			return {
				...current,
				items: current.items.filter((item) => !deletedIds.has(item.id)),
			};
		},
	);
}

function compareWorkspaceItems(
	left: WorkspaceItemSummary,
	right: WorkspaceItemSummary,
) {
	const parentDelta = (left.parentId ?? "").localeCompare(right.parentId ?? "");

	if (parentDelta !== 0) {
		return parentDelta;
	}

	const sortDelta = left.sortOrder - right.sortOrder;

	if (sortDelta !== 0) {
		return sortDelta;
	}

	return left.name.localeCompare(right.name);
}
