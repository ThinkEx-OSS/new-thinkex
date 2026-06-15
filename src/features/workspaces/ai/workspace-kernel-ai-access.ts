import { createDbContext } from "#/db/server";
import { getDocumentSessionRoomName } from "#/features/workspaces/agent-routes";
import type {
	JsonValue,
	WorkspaceItemSummary,
} from "#/features/workspaces/contracts";
import { serializeTiptapDocumentToMarkdown } from "#/features/workspaces/documents/document-markdown";
import type { DocumentMarkdownEdit } from "#/features/workspaces/documents/document-markdown-edits";
import type { DocumentSessionApplyMarkdownEditsResult } from "#/features/workspaces/documents/document-session";
import { parseTiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document";
import {
	getWorkspaceKernel,
	type WorkspaceKernelClient,
} from "#/features/workspaces/kernel/workspace-kernel-access";
import type { ListWorkspaceKernelItemsResult } from "#/features/workspaces/kernel/workspace-kernel-list";
import { listWorkspaceKernelPageItems } from "#/features/workspaces/kernel/workspace-kernel-list";
import {
	buildWorkspaceKernelTree,
	normalizeWorkspacePath,
	resolveWorkspaceKernelItemPath,
	WorkspaceKernelPathError,
} from "#/features/workspaces/kernel/workspace-kernel-paths";
import {
	assertCanMutateWorkspace,
	assertCanReadWorkspace,
} from "#/features/workspaces/server/permissions";

interface DocumentSessionClient {
	applyMarkdownEdits(input: {
		edits: DocumentMarkdownEdit[];
	}): Promise<DocumentSessionApplyMarkdownEditsResult>;
}

export interface ReadWorkspaceKernelAiItemsInput {
	paths: string[];
	recursive?: boolean;
	userId: string;
	workspaceId: string;
}

export type WorkspaceKernelAiReadItem =
	| {
			content: string;
			path: string;
			title: string;
			type: "document";
	  }
	| {
			listing: ListWorkspaceKernelItemsResult;
			path: string;
			title: string;
			type: "folder";
	  }
	| {
			metadata: {
				assetFamily: string | null;
				mimeType: string | null;
				projections: JsonValue | null;
				sizeBytes: number | null;
			};
			path: string;
			title: string;
			type: "file";
	  }
	| {
			path: string;
			reason: "unsupported_item_type";
			title: string;
			type: "flashcard" | "quiz";
	  };

export interface WorkspaceKernelAiReadItemsResult {
	failures: { code: string; path: string }[];
	items: WorkspaceKernelAiReadItem[];
}

export interface EditWorkspaceKernelAiItemInput {
	edits: DocumentMarkdownEdit[];
	path: string;
	userId: string;
	workspaceId: string;
}

export async function readWorkspaceKernelAiItems(
	input: ReadWorkspaceKernelAiItemsInput,
): Promise<WorkspaceKernelAiReadItemsResult> {
	const dbContext = await createDbContext();

	try {
		await assertCanReadWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);
		const page = await kernel.getPage();
		const tree = buildWorkspaceKernelTree(page.items);
		const result: WorkspaceKernelAiReadItemsResult = {
			failures: [],
			items: [],
		};

		for (const path of input.paths) {
			try {
				const normalizedPath = normalizeWorkspacePath(path);

				if (normalizedPath === "/") {
					result.items.push({
						listing: listWorkspaceKernelPageItems({
							items: page.items,
							path: normalizedPath,
							recursive: input.recursive ?? false,
						}),
						path: normalizedPath,
						title: "/",
						type: "folder",
					});
					continue;
				}

				const item = resolveWorkspaceKernelItemPath(normalizedPath, tree);

				if (!item) {
					result.failures.push({
						code: "path_not_found",
						path: normalizedPath,
					});
					continue;
				}

				result.items.push(
					await readWorkspaceKernelAiItem({
						item,
						kernel,
						path: normalizedPath,
						recursive: input.recursive ?? false,
						pageItems: page.items,
					}),
				);
			} catch (error) {
				result.failures.push({
					code: getWorkspaceAiErrorCode(error),
					path,
				});
			}
		}

		return result;
	} finally {
		await dbContext.dispose();
	}
}

export async function editWorkspaceKernelAiItem(
	input: EditWorkspaceKernelAiItemInput,
): Promise<DocumentSessionApplyMarkdownEditsResult> {
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, input);
		const kernel = await getWorkspaceKernel(input.workspaceId);
		const page = await kernel.getPage();
		const tree = buildWorkspaceKernelTree(page.items);
		const normalizedPath = normalizeWorkspacePath(input.path);
		const item = resolveWorkspaceKernelItemPath(normalizedPath, tree);

		if (!item) {
			return failedWorkspaceAiEditResult("path_not_found");
		}

		if (item.type !== "document") {
			return failedWorkspaceAiEditResult("unsupported_item_type");
		}

		const documentSession = await getDocumentSession({
			itemId: item.id,
			workspaceId: input.workspaceId,
		});

		return await documentSession.applyMarkdownEdits({
			edits: input.edits,
		});
	} finally {
		await dbContext.dispose();
	}
}

async function readWorkspaceKernelAiItem(input: {
	item: WorkspaceItemSummary;
	kernel: WorkspaceKernelClient;
	pageItems: WorkspaceItemSummary[];
	path: string;
	recursive: boolean;
}): Promise<WorkspaceKernelAiReadItem> {
	const { item } = input;

	if (item.type === "folder") {
		return {
			listing: listWorkspaceKernelPageItems({
				items: input.pageItems,
				path: input.path,
				recursive: input.recursive,
			}),
			path: input.path,
			title: item.name,
			type: "folder",
		};
	}

	if (item.type === "document") {
		const { content } = await input.kernel.readItem({ itemId: item.id });

		return {
			content: serializeTiptapDocumentToMarkdown(
				parseTiptapDocumentJson(content),
			),
			path: input.path,
			title: item.name,
			type: "document",
		};
	}

	if (item.type === "file") {
		return {
			metadata: {
				assetFamily: getMetadataString(item, "assetFamily"),
				mimeType: getMetadataString(item, "mimeType"),
				projections: item.metadataJson.projections ?? null,
				sizeBytes: getMetadataNumber(item, "sizeBytes"),
			},
			path: input.path,
			title: item.name,
			type: "file",
		};
	}

	return {
		path: input.path,
		reason: "unsupported_item_type",
		title: item.name,
		type: item.type,
	};
}

async function getDocumentSession(input: {
	itemId: string;
	workspaceId: string;
}) {
	const { env } = await import("cloudflare:workers");
	const documentSessionNamespace = env.DocumentSession as unknown as {
		getByName(name: string): DocumentSessionClient;
	};

	return documentSessionNamespace.getByName(getDocumentSessionRoomName(input));
}

function failedWorkspaceAiEditResult(
	code: string,
): DocumentSessionApplyMarkdownEditsResult {
	return {
		applied: 0,
		failed: 1,
		failures: [{ code, index: 0 }],
		status: "failed",
	};
}

function getWorkspaceAiErrorCode(error: unknown) {
	if (error instanceof WorkspaceKernelPathError) {
		return error.code;
	}

	return "workspace_read_failed";
}

function getMetadataString(item: WorkspaceItemSummary, key: string) {
	const value = item.metadataJson[key];

	return typeof value === "string" ? value : null;
}

function getMetadataNumber(item: WorkspaceItemSummary, key: string) {
	const value = item.metadataJson[key];

	return typeof value === "number" ? value : null;
}
