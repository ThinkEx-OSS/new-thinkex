import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
import {
	getWorkspaceKernelAiBatchStatus,
	getWorkspaceKernelAiPageContext,
	resolveWorkspaceKernelAiExistingItemPath,
} from "#/features/workspaces/ai/workspace-kernel-ai-common";
import {
	getParentWorkspacePath,
	joinWorkspaceItemPath,
} from "#/features/workspaces/kernel/workspace-kernel-paths";
import { WorkspaceKernelNameConflictError } from "#/features/workspaces/kernel/workspace-kernel-store";

export interface RenameWorkspaceKernelAiItemInput {
	name: string;
	path: string;
}

export interface RenameWorkspaceKernelAiItemsInput {
	items: RenameWorkspaceKernelAiItemInput[];
	userId: string;
	workspaceId: string;
}

export interface RenameWorkspaceKernelAiFailure {
	code:
		| "cannot_rename_root"
		| "path_already_exists"
		| "path_not_absolute"
		| "path_not_found";
	index: number;
	path: string;
}

export interface RenameWorkspaceKernelAiRenamedItem {
	item: {
		id: string;
		title: string;
		type: WorkspaceItemSummary["type"];
	};
	path: string;
	previousPath: string;
}

export interface RenameWorkspaceKernelAiItemsResult {
	failed: RenameWorkspaceKernelAiFailure[];
	renamed: RenameWorkspaceKernelAiRenamedItem[];
	status: ReturnType<typeof getWorkspaceKernelAiBatchStatus>;
}

export async function renameWorkspaceKernelAiItems(
	input: RenameWorkspaceKernelAiItemsInput,
): Promise<RenameWorkspaceKernelAiItemsResult> {
	const context = await getWorkspaceKernelAiPageContext({
		access: "mutate",
		userId: input.userId,
		workspaceId: input.workspaceId,
	});
	const failed: RenameWorkspaceKernelAiFailure[] = [];
	const resolvedItems: Array<{
		index: number;
		input: RenameWorkspaceKernelAiItemInput;
		item: WorkspaceItemSummary;
		path: string;
	}> = [];

	for (const [index, itemInput] of input.items.entries()) {
		const resolution = resolveWorkspaceKernelAiExistingItemPath({
			path: itemInput.path,
			rootFailureCode: "cannot_rename_root",
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
			index,
			input: itemInput,
			item: resolution.item,
			path: resolution.path,
		});
	}

	const renamed: RenameWorkspaceKernelAiRenamedItem[] = [];

	for (const resolved of resolvedItems) {
		let command: Awaited<ReturnType<typeof context.kernel.renameItem>>;

		try {
			command = await context.kernel.renameItem({
				itemId: resolved.item.id,
				name: resolved.input.name,
				onNameConflict: "error",
				actorUserId: input.userId,
				clientMutationId: null,
			});
		} catch (error) {
			if (error instanceof WorkspaceKernelNameConflictError) {
				failed.push({
					code: "path_already_exists",
					index: resolved.index,
					path: resolved.path,
				});
				continue;
			}

			throw error;
		}

		renamed.push({
			item: {
				id: command.result.id,
				title: command.result.name,
				type: command.result.type,
			},
			path: joinWorkspaceItemPath(
				getParentWorkspacePath(resolved.path),
				command.result.name,
			),
			previousPath: resolved.path,
		});
	}

	return {
		failed,
		renamed,
		status: getWorkspaceKernelAiBatchStatus({
			failedCount: failed.length,
			succeededCount: renamed.length,
		}),
	};
}
