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
	normalizeWorkspacePath,
	resolveWorkspaceKernelItemPath,
	WorkspaceKernelPathError,
} from "#/features/workspaces/kernel/workspace-kernel-paths";
import type {
	ReadWorkspaceKernelFileProjectionResult,
	WorkspaceKernelFileProjectionStatus,
} from "#/features/workspaces/kernel/workspace-kernel-types";
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
				assetFamily: string | null;
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

const DEFAULT_AI_READ_CONTENT_LIMIT = 2000;
const MAX_AI_READ_CONTENT_LINES = 2000;
const MAX_AI_READ_LINE_LENGTH = 2000;
const TRUNCATED_LINE_SUFFIX = `... (line truncated to ${MAX_AI_READ_LINE_LENGTH} chars)`;

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
						contentLimit: input.contentLimit,
						contentOffset: input.contentOffset,
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
	const metadata = {
		assetFamily: getMetadataString(item, "assetFamily"),
		mimeType: getMetadataString(item, "mimeType"),
		sizeBytes: getMetadataNumber(item, "sizeBytes"),
	};

	if (metadata.assetFamily !== "pdf") {
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
				reason:
					projection.status === "needs_review"
						? "extracted_markdown_needs_review"
						: "extracted_markdown_ready",
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

function getMetadataString(item: WorkspaceItemSummary, key: string) {
	const value = item.metadataJson[key];

	return typeof value === "string" ? value : null;
}

function getMetadataNumber(item: WorkspaceItemSummary, key: string) {
	const value = item.metadataJson[key];

	return typeof value === "number" ? value : null;
}
