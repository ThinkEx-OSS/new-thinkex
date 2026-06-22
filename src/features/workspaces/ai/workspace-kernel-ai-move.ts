import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
import {
	getWorkspaceKernelAiBatchStatus,
	getWorkspaceKernelAiPageContext,
	resolveWorkspaceKernelAiExistingItemPath,
	resolveWorkspaceKernelAiPath,
} from "#/features/workspaces/ai/workspace-kernel-ai-common";
import {
	getParentWorkspacePath,
	joinWorkspaceItemPath,
	type WorkspaceKernelTree,
} from "#/features/workspaces/kernel/workspace-kernel-paths";
import { WorkspaceKernelNameConflictError } from "#/features/workspaces/kernel/workspace-kernel-store";

export interface MoveWorkspaceKernelAiItemsInput {
	destinationPath: string;
	paths: string[];
	userId: string;
	workspaceId: string;
}

export interface MoveWorkspaceKernelAiDestinationFailure {
	code:
		| "destination_path_not_absolute"
		| "destination_path_not_folder"
		| "destination_path_not_found";
	path: string;
}

export interface MoveWorkspaceKernelAiFailure {
	code:
		| "already_in_destination"
		| "cannot_move_into_descendant"
		| "cannot_move_root"
		| "path_already_exists"
		| "path_not_absolute"
		| "path_not_found";
	index: number;
	path: string;
}

export interface MoveWorkspaceKernelAiMovedItem {
	item: {
		id: string;
		title: string;
		type: WorkspaceItemSummary["type"];
	};
	path: string;
	previousPath: string;
}

export interface MoveWorkspaceKernelAiItemsResult {
	destinationFailure?: MoveWorkspaceKernelAiDestinationFailure;
	failed: MoveWorkspaceKernelAiFailure[];
	moved: MoveWorkspaceKernelAiMovedItem[];
	status: ReturnType<typeof getWorkspaceKernelAiBatchStatus>;
}

export async function moveWorkspaceKernelAiItems(
	input: MoveWorkspaceKernelAiItemsInput,
): Promise<MoveWorkspaceKernelAiItemsResult> {
	const context = await getWorkspaceKernelAiPageContext({
		access: "mutate",
		userId: input.userId,
		workspaceId: input.workspaceId,
	});
	const destination = resolveWorkspaceKernelAiMoveDestination({
		path: input.destinationPath,
		tree: context.tree,
	});

	if (destination.status === "failed") {
		return {
			destinationFailure: destination.failure,
			failed: [],
			moved: [],
			status: getWorkspaceKernelAiBatchStatus({
				failedCount: input.paths.length,
				succeededCount: 0,
			}),
		};
	}

	const failed: MoveWorkspaceKernelAiFailure[] = [];
	const resolvedItems: Array<{
		index: number;
		item: WorkspaceItemSummary;
		path: string;
	}> = [];

	for (const [index, path] of input.paths.entries()) {
		const resolution = resolveWorkspaceKernelAiExistingItemPath({
			path,
			rootFailureCode: "cannot_move_root",
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

		if (
			resolution.item.type === "folder" &&
			isWorkspacePathEqualOrDescendant(resolution.path, destination.path)
		) {
			failed.push({
				code: "cannot_move_into_descendant",
				index,
				path: resolution.path,
			});
			continue;
		}

		if (getParentWorkspacePath(resolution.path) === destination.path) {
			failed.push({
				code: "already_in_destination",
				index,
				path: resolution.path,
			});
			continue;
		}

		resolvedItems.push({
			index,
			item: resolution.item,
			path: resolution.path,
		});
	}

	if (resolvedItems.length === 0) {
		return {
			failed,
			moved: [],
			status: getWorkspaceKernelAiBatchStatus({
				failedCount: failed.length,
				succeededCount: 0,
			}),
		};
	}

	const moved: MoveWorkspaceKernelAiMovedItem[] = [];
	const pendingItems = [...resolvedItems];

	while (pendingItems.length > 0) {
		try {
			const command = await context.kernel.moveItems({
				items: pendingItems.map((resolved) => ({ itemId: resolved.item.id })),
				parentId: destination.parentId,
				onNameConflict: "error",
				actorUserId: input.userId,
				clientMutationId: null,
			});
			const pendingItemsById = new Map<string, (typeof pendingItems)[number]>();

			for (const pendingItem of pendingItems) {
				if (!pendingItemsById.has(pendingItem.item.id)) {
					pendingItemsById.set(pendingItem.item.id, pendingItem);
				}
			}

			moved.push(
				...command.result.map((item) => {
					const resolved = pendingItemsById.get(item.id);

					if (!resolved) {
						throw new Error(
							`Moved workspace item was not resolved: ${item.id}`,
						);
					}

					return {
						item: {
							id: item.id,
							title: item.name,
							type: item.type,
						},
						path: joinWorkspaceItemPath(destination.path, item.name),
						previousPath: resolved.path,
					};
				}),
			);
			break;
		} catch (error) {
			if (error instanceof WorkspaceKernelNameConflictError && error.itemId) {
				const conflictIndex = pendingItems.findIndex(
					(resolved) => resolved.item.id === error.itemId,
				);

				if (conflictIndex >= 0) {
					const [conflictedItem] = pendingItems.splice(conflictIndex, 1);

					failed.push({
						code: "path_already_exists",
						index: conflictedItem.index,
						path: conflictedItem.path,
					});
					continue;
				}
			}

			throw error;
		}
	}

	return {
		failed,
		moved,
		status: getWorkspaceKernelAiBatchStatus({
			failedCount: failed.length,
			succeededCount: input.paths.length - failed.length,
		}),
	};
}

function resolveWorkspaceKernelAiMoveDestination(input: {
	path: string;
	tree: WorkspaceKernelTree;
}):
	| {
			failure: MoveWorkspaceKernelAiDestinationFailure;
			status: "failed";
	  }
	| {
			parentId: string | null;
			path: string;
			status: "destination";
	  } {
	const resolution = resolveWorkspaceKernelAiPath(input);

	if (resolution.status === "invalid_path") {
		return {
			failure: {
				code: "destination_path_not_absolute",
				path: resolution.path,
			},
			status: "failed",
		};
	}

	if (resolution.status === "not_found") {
		return {
			failure: {
				code: "destination_path_not_found",
				path: resolution.path,
			},
			status: "failed",
		};
	}

	if (resolution.status === "root") {
		return {
			parentId: null,
			path: resolution.path,
			status: "destination",
		};
	}

	if (resolution.item.type !== "folder") {
		return {
			failure: {
				code: "destination_path_not_folder",
				path: resolution.path,
			},
			status: "failed",
		};
	}

	return {
		parentId: resolution.item.id,
		path: resolution.path,
		status: "destination",
	};
}

function isWorkspacePathEqualOrDescendant(
	ancestorPath: string,
	candidatePath: string,
) {
	return (
		candidatePath === ancestorPath ||
		candidatePath.startsWith(`${ancestorPath}/`)
	);
}
