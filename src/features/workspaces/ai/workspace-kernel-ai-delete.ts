import {
	getWorkspaceKernelAiBatchStatus,
	getWorkspaceKernelAiPageContext,
	resolveWorkspaceKernelAiExistingItemPath,
} from "#/features/workspaces/ai/workspace-kernel-ai-common";
import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";

export interface DeleteWorkspaceKernelAiItemsInput {
	paths: string[];
	userId: string;
	workspaceId: string;
}

export interface DeleteWorkspaceKernelAiFailure {
	code: "cannot_delete_root" | "path_not_absolute" | "path_not_found";
	index: number;
	path: string;
}

export interface DeleteWorkspaceKernelAiDeletedItem {
	item: {
		id: string;
		title: string;
		type: WorkspaceItemSummary["type"];
	};
	path: string;
}

export interface DeleteWorkspaceKernelAiItemsResult {
	deleted: DeleteWorkspaceKernelAiDeletedItem[];
	deletedItemCount: number;
	failed: DeleteWorkspaceKernelAiFailure[];
	status: ReturnType<typeof getWorkspaceKernelAiBatchStatus>;
}

export async function deleteWorkspaceKernelAiItems(
	input: DeleteWorkspaceKernelAiItemsInput,
): Promise<DeleteWorkspaceKernelAiItemsResult> {
	const context = await getWorkspaceKernelAiPageContext({
		access: "mutate",
		userId: input.userId,
		workspaceId: input.workspaceId,
	});
	const failed: DeleteWorkspaceKernelAiFailure[] = [];
	const resolvedItems: Array<{
		item: WorkspaceItemSummary;
		path: string;
	}> = [];

	for (const [index, path] of input.paths.entries()) {
		const resolution = resolveWorkspaceKernelAiExistingItemPath({
			path,
			rootFailureCode: "cannot_delete_root",
			tree: context.tree,
		});

		if (resolution.status === "failed") {
			failed.push({
				code: resolution.failure.code,
				index,
				path: resolution.failure.path,
			});
			continue;
		}

		resolvedItems.push({
			item: resolution.item,
			path: resolution.path,
		});
	}

	if (resolvedItems.length === 0) {
		return {
			deleted: [],
			deletedItemCount: 0,
			failed,
			status: getWorkspaceKernelAiBatchStatus({
				failedCount: failed.length,
				succeededCount: 0,
			}),
		};
	}

	const command = await context.kernel.deleteItems({
		itemIds: resolvedItems.map((resolved) => resolved.item.id),
		actorUserId: input.userId,
		clientMutationId: null,
	});
	const resolvedItemsById = new Map<string, (typeof resolvedItems)[number]>();

	for (const resolved of resolvedItems) {
		if (!resolvedItemsById.has(resolved.item.id)) {
			resolvedItemsById.set(resolved.item.id, resolved);
		}
	}

	const deleted = command.result.itemIds.map((itemId) => {
		const resolved = resolvedItemsById.get(itemId);

		if (!resolved) {
			throw new Error(`Deleted workspace item was not resolved: ${itemId}`);
		}

		return {
			item: {
				id: resolved.item.id,
				title: resolved.item.name,
				type: resolved.item.type,
			},
			path: resolved.path,
		};
	});

	return {
		deleted,
		deletedItemCount: command.result.deletedItemIds.length,
		failed,
		status: getWorkspaceKernelAiBatchStatus({
			failedCount: failed.length,
			succeededCount: input.paths.length - failed.length,
		}),
	};
}
