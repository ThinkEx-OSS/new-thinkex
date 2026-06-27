import {
	getWorkspaceKernelAiPageContext,
	resolveWorkspaceKernelAiPath,
} from "#/features/workspaces/ai/workspace-kernel-ai-common";
import {
	readWorkspaceAiPdfPages,
	WorkspaceKernelAiPdfPageError,
	type WorkspaceKernelAiPdfPages,
} from "#/features/workspaces/ai/workspace-kernel-ai-pdf-pages";
import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
import { serializeTiptapDocumentToMarkdown } from "#/features/workspaces/documents/document-markdown";
import { parseTiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document";
import type { WorkspaceKernelClient } from "#/features/workspaces/kernel/workspace-kernel-access";
import { resolveWorkspaceFileTypeFromItem } from "#/features/workspaces/model/workspace-file";

interface WorkspaceKernelAiContentPage {
	lineTruncated?: boolean;
	next?: number;
	truncated: boolean;
}

export interface ReadWorkspaceKernelAiItemsInput {
	contentLimit?: number;
	contentOffset?: number;
	pages?: string;
	paths: string[];
	userId: string;
	workspaceId: string;
}

export interface WorkspaceKernelAiReadItem {
	content?: string;
	page?: WorkspaceKernelAiContentPage;
	pdfPages?: WorkspaceKernelAiPdfPages;
	path: string;
	status: "failed" | "pending" | "ready" | "unsupported";
	type: "document" | "file" | "flashcard" | "quiz";
}

export interface WorkspaceKernelAiReadItemsResult {
	items: WorkspaceKernelAiReadItem[];
	failed: WorkspaceKernelAiReadFailure[];
}

const DEFAULT_AI_READ_CONTENT_LIMIT = 2000;
const MAX_AI_READ_CONTENT_LINES = 2000;
const MAX_AI_READ_LINE_LENGTH = 2000;
const TRUNCATED_LINE_SUFFIX = `... (line truncated to ${MAX_AI_READ_LINE_LENGTH} chars)`;

type WorkspaceKernelAiReadFailureCode =
	| "content_offset_out_of_range"
	| "page_range_out_of_range"
	| "path_is_folder"
	| "path_not_absolute"
	| "path_not_found";

interface WorkspaceKernelAiReadFailure {
	code: WorkspaceKernelAiReadFailureCode;
	index: number;
	path: string;
}

export async function readWorkspaceKernelAiItems(
	input: ReadWorkspaceKernelAiItemsInput,
): Promise<WorkspaceKernelAiReadItemsResult> {
	const context = await getWorkspaceKernelAiPageContext({
		access: "read",
		userId: input.userId,
		workspaceId: input.workspaceId,
	});
	const result: WorkspaceKernelAiReadItemsResult = {
		items: [],
		failed: [],
	};

	for (const [index, path] of input.paths.entries()) {
		const resolution = resolveWorkspaceKernelAiPath({
			path,
			tree: context.tree,
		});

		if (resolution.status === "invalid_path") {
			result.failed.push({
				code: resolution.code,
				index,
				path: resolution.path,
			});
			continue;
		}

		if (resolution.status === "root") {
			result.failed.push({
				code: "path_is_folder",
				index,
				path: resolution.path,
			});
			continue;
		}

		if (resolution.status === "not_found") {
			result.failed.push({
				code: "path_not_found",
				index,
				path: resolution.path,
			});
			continue;
		}

		if (resolution.item.type === "folder") {
			result.failed.push({
				code: "path_is_folder",
				index,
				path: resolution.path,
			});
			continue;
		}

		try {
			result.items.push(
				await readWorkspaceKernelAiItem({
					contentLimit: input.contentLimit,
					contentOffset: input.contentOffset,
					item: resolution.item,
					kernel: context.kernel,
					pages: input.pages,
					path: resolution.path,
				}),
			);
		} catch (error) {
			if (error instanceof WorkspaceKernelAiPdfPageError) {
				result.failed.push({
					code: error.code,
					index,
					path: resolution.path,
				});
				continue;
			}

			if (error instanceof WorkspaceAiContentPageError) {
				result.failed.push({
					code: error.code,
					index,
					path: resolution.path,
				});
				continue;
			}

			throw error;
		}
	}

	return result;
}

async function readWorkspaceKernelAiItem(input: {
	contentLimit?: number;
	contentOffset?: number;
	item: WorkspaceItemSummary;
	kernel: WorkspaceKernelClient;
	pages?: string;
	path: string;
}): Promise<WorkspaceKernelAiReadItem> {
	const { item } = input;

	if (item.type === "folder") {
		throw new Error("Folder paths should be handled before item reads.");
	}

	if (item.type === "document") {
		const { content } = await input.kernel.readItem({ itemId: item.id });
		const markdown = serializeTiptapDocumentToMarkdown(parseTiptapDocumentJson(content));
		const page = pageWorkspaceAiMarkdown(markdown, {
			limit: input.contentLimit,
			offset: input.contentOffset,
		});

		return {
			content: page.content,
			...(page.page ? { page: page.page } : {}),
			path: input.path,
			status: "ready",
			type: "document",
		};
	}

	if (item.type === "file") {
		return await readWorkspaceKernelAiFileItem(input);
	}

	return {
		path: input.path,
		status: "unsupported",
		type: item.type,
	};
}

async function readWorkspaceKernelAiFileItem(input: {
	contentLimit?: number;
	contentOffset?: number;
	item: WorkspaceItemSummary;
	kernel: WorkspaceKernelClient;
	pages?: string;
	path: string;
}): Promise<WorkspaceKernelAiReadItem> {
	const { item } = input;
	const fileType = resolveWorkspaceFileTypeFromItem(item);

	if (!fileType) {
		return createWorkspaceKernelAiFileStatusItem(input.path, "unsupported");
	}

	if (fileType.aiReadStrategy !== "markdown_extraction") {
		return createWorkspaceKernelAiFileStatusItem(input.path, "unsupported");
	}

	const projection = await input.kernel.readFileProjection({
		itemId: item.id,
		format: "markdown",
	});

	if (!projection) {
		return createWorkspaceKernelAiFileStatusItem(input.path, "pending");
	}

	if (
		projection.status === "not_started" ||
		projection.status === "queued" ||
		projection.status === "processing"
	) {
		return createWorkspaceKernelAiFileStatusItem(input.path, "pending");
	}

	if (projection.status !== "ready" || projection.content === null) {
		return createWorkspaceKernelAiFileStatusItem(input.path, "failed");
	}

	if (fileType.assetKind === "pdf") {
		const pageRead = readWorkspaceAiPdfPages(projection.content, {
			pages: input.pages,
		});

		return {
			content: pageRead.content,
			pdfPages: pageRead.pdfPages,
			path: input.path,
			status: "ready",
			type: "file",
		};
	}

	const page = pageWorkspaceAiMarkdown(projection.content, {
		limit: input.contentLimit,
		offset: input.contentOffset,
	});

	return {
		content: page.content,
		...(page.page ? { page: page.page } : {}),
		path: input.path,
		status: "ready",
		type: "file",
	};
}

function createWorkspaceKernelAiFileStatusItem(
	path: string,
	status: WorkspaceKernelAiReadItem["status"],
): WorkspaceKernelAiReadItem {
	return {
		path,
		status,
		type: "file",
	};
}

function pageWorkspaceAiMarkdown(
	content: string,
	input: { limit?: number; offset?: number },
): { content: string; page?: WorkspaceKernelAiContentPage } {
	const offset = input.offset ?? 1;
	const limit = Math.min(input.limit ?? DEFAULT_AI_READ_CONTENT_LIMIT, MAX_AI_READ_CONTENT_LINES);
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
	constructor(readonly code: "content_offset_out_of_range") {
		super(code);
	}
}
