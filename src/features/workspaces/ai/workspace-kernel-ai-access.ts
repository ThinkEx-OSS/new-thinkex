import { createDbContext } from "#/db/server";
import { getDocumentSessionRoomName } from "#/features/workspaces/agent-routes";
import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
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
	joinWorkspacePathSegment,
	normalizeWorkspacePath,
	resolveWorkspaceKernelItemPath,
	type WorkspaceKernelTree,
	WorkspaceKernelPathError,
} from "#/features/workspaces/kernel/workspace-kernel-paths";
import type {
	ReadWorkspaceKernelFileProjectionResult,
	WorkspaceKernelFileProjectionStatus,
} from "#/features/workspaces/kernel/workspace-kernel-types";
import {
	getMetadataNumber,
	getMetadataString,
	resolveWorkspaceFileTypeFromItem,
} from "#/features/workspaces/model/workspace-file";
import {
	assertCanMutateWorkspace,
	assertCanReadWorkspace,
} from "#/features/workspaces/server/permissions";

interface DocumentSessionClient {
	applyMarkdownEdits(input: {
		edits: DocumentMarkdownEdit[];
	}): Promise<DocumentSessionApplyMarkdownEditsResult>;
}

interface WorkspaceKernelAiFileExtraction {
	errorMessage?: string | null;
	reason: string;
	status: WorkspaceKernelFileProjectionStatus;
}

interface WorkspaceKernelAiContentPage {
	lineTruncated?: boolean;
	next?: number;
	offset?: number;
	truncated: boolean;
}

export interface ReadWorkspaceKernelAiItemsInput {
	contentLimit?: number;
	contentOffset?: number;
	paths: string[];
	recursive?: boolean;
	userId: string;
	workspaceId: string;
}

export type WorkspaceKernelAiReadItem =
	| {
			content: string;
			page?: WorkspaceKernelAiContentPage;
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
			content?: string;
			extraction: WorkspaceKernelAiFileExtraction;
			metadata?: {
				assetKind: string | null;
				mimeType: string | null;
				sizeBytes: number | null;
			};
			page?: WorkspaceKernelAiContentPage;
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
	code: "cannot_rename_root" | "path_not_absolute" | "path_not_found";
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
	status: "completed" | "failed" | "partial";
}

const DEFAULT_AI_READ_CONTENT_LIMIT = 2000;
const MAX_AI_READ_CONTENT_LINES = 2000;
const MAX_AI_READ_LINE_LENGTH = 2000;
const TRUNCATED_LINE_SUFFIX = `... (line truncated to ${MAX_AI_READ_LINE_LENGTH} chars)`;

type WorkspaceKernelAiAccessMode = "read" | "mutate";

type WorkspaceKernelAiPathResolution =
	| {
			code: "path_not_absolute";
			path: string;
			status: "invalid_path";
	  }
	| {
			path: string;
			status: "not_found" | "root";
	  }
	| {
			item: WorkspaceItemSummary;
			path: string;
			status: "item";
	  };

export async function readWorkspaceKernelAiItems(
	input: ReadWorkspaceKernelAiItemsInput,
): Promise<WorkspaceKernelAiReadItemsResult> {
	const context = await getWorkspaceKernelAiPageContext({
		access: "read",
		userId: input.userId,
		workspaceId: input.workspaceId,
	});
	const result: WorkspaceKernelAiReadItemsResult = {
		failures: [],
		items: [],
	};

	for (const path of input.paths) {
		try {
			const resolution = resolveWorkspaceKernelAiPath({
				path,
				tree: context.tree,
			});

			if (resolution.status === "invalid_path") {
				result.failures.push({
					code: resolution.code,
					path: resolution.path,
				});
				continue;
			}

			if (resolution.status === "root") {
				result.items.push({
					listing: listWorkspaceKernelPageItems({
						items: context.pageItems,
						path: resolution.path,
						recursive: input.recursive ?? false,
					}),
					path: resolution.path,
					title: "/",
					type: "folder",
				});
				continue;
			}

			if (resolution.status === "not_found") {
				result.failures.push({
					code: "path_not_found",
					path: resolution.path,
				});
				continue;
			}

			if (resolution.status !== "item") {
				continue;
			}

			result.items.push(
				await readWorkspaceKernelAiItem({
					contentLimit: input.contentLimit,
					contentOffset: input.contentOffset,
					item: resolution.item,
					kernel: context.kernel,
					path: resolution.path,
					recursive: input.recursive ?? false,
					pageItems: context.pageItems,
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
}

export async function editWorkspaceKernelAiItem(
	input: EditWorkspaceKernelAiItemInput,
): Promise<DocumentSessionApplyMarkdownEditsResult> {
	const context = await getWorkspaceKernelAiPageContext({
		access: "mutate",
		userId: input.userId,
		workspaceId: input.workspaceId,
	});
	const resolution = resolveWorkspaceKernelAiPath({
		path: input.path,
		tree: context.tree,
	});

	if (resolution.status === "invalid_path") {
		return failedWorkspaceAiEditResult(resolution.code);
	}

	if (resolution.status === "root" || resolution.status === "not_found") {
		return failedWorkspaceAiEditResult("path_not_found");
	}

	if (resolution.status !== "item") {
		return failedWorkspaceAiEditResult("path_not_found");
	}

	if (resolution.item.type !== "document") {
		return failedWorkspaceAiEditResult("unsupported_item_type");
	}

	const documentSession = await getDocumentSession({
		itemId: resolution.item.id,
		workspaceId: input.workspaceId,
	});

	return await documentSession.applyMarkdownEdits({
		edits: input.edits,
	});
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
		input: RenameWorkspaceKernelAiItemInput;
		item: WorkspaceItemSummary;
		path: string;
	}> = [];

	for (const itemInput of input.items) {
		const resolution = resolveWorkspaceKernelAiPath({
			path: itemInput.path,
			tree: context.tree,
		});

		if (resolution.status === "invalid_path") {
			failed.push({
				code: resolution.code,
				path: resolution.path,
			});
			continue;
		}

		if (resolution.status === "root") {
			failed.push({
				code: "cannot_rename_root",
				path: resolution.path,
			});
			continue;
		}

			if (resolution.status === "not_found") {
				failed.push({
					code: "path_not_found",
					path: resolution.path,
				});
				continue;
			}

			if (resolution.status !== "item") {
				continue;
			}

			resolvedItems.push({
				input: itemInput,
			item: resolution.item,
			path: resolution.path,
		});
	}

	const renamedCommands: Array<{
		command: Awaited<ReturnType<WorkspaceKernelClient["renameItem"]>>;
		previousPath: string;
	}> = [];

	for (const resolved of resolvedItems) {
		const command = await context.kernel.renameItem({
			itemId: resolved.item.id,
			name: resolved.input.name,
			actorUserId: input.userId,
			clientMutationId: null,
		});

		renamedCommands.push({
			command,
			previousPath: resolved.path,
		});
	}

	const finalPaths =
		renamedCommands.length > 0
			? buildWorkspaceKernelItemPathIndex(
					(await context.kernel.getPage()).items,
				)
			: new Map<string, string>();

	const renamed = renamedCommands.map(({ command, previousPath }) => ({
		item: {
			id: command.result.id,
			title: command.result.name,
			type: command.result.type,
		},
		path:
			finalPaths.get(command.result.id) ??
			joinWorkspaceItemPath(
				getParentWorkspacePath(previousPath),
				command.result.name,
			),
		previousPath,
	}));

	return {
		failed,
		renamed,
		status: getWorkspaceKernelAiRenameStatus({
			failedCount: failed.length,
			renamedCount: renamed.length,
		}),
	};
}

async function getWorkspaceKernelAiPageContext(input: {
	access: WorkspaceKernelAiAccessMode;
	userId: string;
	workspaceId: string;
}) {
	const dbContext = await createDbContext();

	try {
		if (input.access === "read") {
			await assertCanReadWorkspace(dbContext.db, input);
		} else {
			await assertCanMutateWorkspace(dbContext.db, input);
		}

		const kernel = await getWorkspaceKernel(input.workspaceId);
		const page = await kernel.getPage();

		return {
			kernel,
			pageItems: page.items,
			tree: buildWorkspaceKernelTree(page.items),
		};
	} finally {
		await dbContext.dispose();
	}
}

function resolveWorkspaceKernelAiPath(input: {
	path: string;
	tree: WorkspaceKernelTree;
}): WorkspaceKernelAiPathResolution {
	try {
		const normalizedPath = normalizeWorkspacePath(input.path);

		if (normalizedPath === "/") {
			return {
				path: normalizedPath,
				status: "root",
			};
		}

		const item = resolveWorkspaceKernelItemPath(normalizedPath, input.tree);

		if (!item) {
			return {
				path: normalizedPath,
				status: "not_found",
			};
		}

		return {
			item,
			path: normalizedPath,
			status: "item",
		};
	} catch (error) {
		if (
			error instanceof WorkspaceKernelPathError &&
			error.code === "path_not_absolute"
		) {
			return {
				code: error.code,
				path: input.path,
				status: "invalid_path",
			};
		}

		throw error;
	}
}

async function readWorkspaceKernelAiItem(input: {
	contentLimit?: number;
	contentOffset?: number;
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
		const markdown = serializeTiptapDocumentToMarkdown(
			parseTiptapDocumentJson(content),
		);
		const page = pageWorkspaceAiMarkdown(markdown, {
			limit: input.contentLimit,
			offset: input.contentOffset,
		});

		return {
			content: page.content,
			...(page.page ? { page: page.page } : {}),
			path: input.path,
			title: item.name,
			type: "document",
		};
	}

	if (item.type === "file") {
		return await readWorkspaceKernelAiFileItem(input);
	}

	return {
		path: input.path,
		reason: "unsupported_item_type",
		title: item.name,
		type: item.type,
	};
}

async function readWorkspaceKernelAiFileItem(input: {
	contentLimit?: number;
	contentOffset?: number;
	item: WorkspaceItemSummary;
	kernel: WorkspaceKernelClient;
	path: string;
}): Promise<WorkspaceKernelAiReadItem> {
	const { item } = input;
	const fileType = resolveWorkspaceFileTypeFromItem(item);
	const metadata = {
		assetKind: getMetadataString(item.metadataJson, "assetKind"),
		mimeType: getMetadataString(item.metadataJson, "mimeType"),
		sizeBytes: getMetadataNumber(item.metadataJson, "sizeBytes"),
	};

	if (!fileType) {
		return {
			extraction: {
				reason: "unsupported_file_type",
				status: "not_started",
			},
			metadata,
			path: input.path,
			title: item.name,
			type: "file",
		};
	}

	if (fileType.aiReadStrategy !== "markdown_extraction") {
		return {
			extraction: {
				reason: "no_text_projection_available",
				status: "not_started",
			},
			metadata,
			path: input.path,
			title: item.name,
			type: "file",
		};
	}

	const projection = await input.kernel.readFileProjection({
		itemId: item.id,
		format: "markdown",
	});

	if (projection?.content && isReadableProjectionStatus(projection.status)) {
		const page = pageWorkspaceAiMarkdown(projection.content, {
			limit: input.contentLimit,
			offset: input.contentOffset,
		});

		return {
			content: page.content,
			extraction: {
				reason: "extracted_markdown_ready",
				status: projection.status,
			},
			...(page.page ? { page: page.page } : {}),
			path: input.path,
			title: item.name,
			type: "file",
		};
	}

	return {
		extraction: getFileExtractionStatus(projection),
		path: input.path,
		title: item.name,
		type: "file",
	};
}

function isReadableProjectionStatus(
	status: WorkspaceKernelFileProjectionStatus,
) {
	return status === "ready" || status === "needs_review";
}

function getFileExtractionStatus(
	projection: ReadWorkspaceKernelFileProjectionResult | null,
): WorkspaceKernelAiFileExtraction {
	if (!projection) {
		return {
			reason: "extraction_not_started",
			status: "not_started",
		};
	}

	return {
		errorMessage: projection.errorMessage,
		reason: getFileExtractionReason(projection.status),
		status: projection.status,
	};
}

function getFileExtractionReason(status: WorkspaceKernelFileProjectionStatus) {
	switch (status) {
		case "queued":
			return "extraction_queued_try_again_later";
		case "processing":
			return "extraction_processing_try_again_later";
		case "failed":
			return "extraction_failed";
		case "needs_review":
			return "extracted_markdown_needs_review_but_content_missing";
		case "ready":
			return "extracted_markdown_ready_but_content_missing";
		case "not_started":
			return "extraction_not_started";
	}
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
	if (error instanceof WorkspaceAiContentPageError) {
		return error.code;
	}

	if (error instanceof WorkspaceKernelPathError) {
		return error.code;
	}

	return "workspace_read_failed";
}

function getParentWorkspacePath(path: string) {
	const lastSlashIndex = path.lastIndexOf("/");

	if (lastSlashIndex <= 0) {
		return "/";
	}

	return path.slice(0, lastSlashIndex);
}

function joinWorkspaceItemPath(parentPath: string, name: string) {
	const relativePath = joinWorkspacePathSegment("", name);

	if (parentPath === "/") {
		return `/${relativePath}`;
	}

	return `${parentPath}/${relativePath}`;
}

function buildWorkspaceKernelItemPathIndex(items: WorkspaceItemSummary[]) {
	const tree = buildWorkspaceKernelTree(items);
	const paths = new Map<string, string>();

	const visit = (parentId: string | null, parentPath: string) => {
		for (const child of tree.childrenByParentId.get(parentId) ?? []) {
			const path = joinWorkspaceItemPath(parentPath, child.name);
			paths.set(child.id, path);
			visit(child.id, path);
		}
	};

	visit(null, "/");

	return paths;
}

function getWorkspaceKernelAiRenameStatus(input: {
	failedCount: number;
	renamedCount: number;
}): RenameWorkspaceKernelAiItemsResult["status"] {
	if (input.renamedCount === 0) {
		return "failed";
	}

	if (input.failedCount === 0) {
		return "completed";
	}

	return "partial";
}

function pageWorkspaceAiMarkdown(
	content: string,
	input: { limit?: number; offset?: number },
): { content: string; page?: WorkspaceKernelAiContentPage } {
	const offset = input.offset ?? 1;
	const limit = Math.min(
		input.limit ?? DEFAULT_AI_READ_CONTENT_LIMIT,
		MAX_AI_READ_CONTENT_LINES,
	);
	const lines = content === "" ? [] : content.split(/\r?\n/);

	if (offset > Math.max(lines.length, 1)) {
		throw new WorkspaceAiContentPageError("content_offset_out_of_range");
	}

	const selected: string[] = [];
	let lineTruncated = false;
	let truncated = false;
	let next: number | undefined;

	for (let index = offset - 1; index < lines.length; index += 1) {
		if (selected.length >= limit) {
			truncated = true;
			next = index + 1;
			break;
		}

		const line = truncateWorkspaceAiMarkdownLine(lines[index] ?? "");
		lineTruncated = lineTruncated || line.truncated;
		selected.push(line.value);
	}

	const page: WorkspaceKernelAiContentPage | undefined =
		truncated || lineTruncated || offset !== 1
			? {
					...(lineTruncated ? { lineTruncated } : {}),
					...(offset !== 1 ? { offset } : {}),
					truncated: truncated || lineTruncated,
					...(next === undefined ? {} : { next }),
				}
			: undefined;

	return {
		content: selected.join("\n"),
		...(page ? { page } : {}),
	};
}

function truncateWorkspaceAiMarkdownLine(line: string) {
	if (line.length <= MAX_AI_READ_LINE_LENGTH) {
		return { truncated: false, value: line };
	}

	return {
		truncated: true,
		value: line.slice(0, MAX_AI_READ_LINE_LENGTH) + TRUNCATED_LINE_SUFFIX,
	};
}

class WorkspaceAiContentPageError extends Error {
	constructor(readonly code: string) {
		super(code);
	}
}
