import {
	getWorkspaceKernelAiPageContext,
	resolveWorkspaceKernelAiPath,
} from "#/features/workspaces/ai/workspace-kernel-ai-common";
import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
import { serializeTiptapDocumentToMarkdown } from "#/features/workspaces/documents/document-markdown";
import { parseTiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document";
import type { WorkspaceKernelClient } from "#/features/workspaces/kernel/workspace-kernel-access";
import type {
	ReadWorkspaceKernelFileProjectionResult,
	WorkspaceKernelFileProjectionStatus,
} from "#/features/workspaces/kernel/workspace-kernel-types";
import { resolveWorkspaceFileTypeFromItem } from "#/features/workspaces/model/workspace-file";

interface WorkspaceKernelAiContentPage {
	lineTruncated?: boolean;
	next?: number;
	truncated: boolean;
}

export interface ReadWorkspaceKernelAiItemsInput {
	contentLimit?: number;
	contentOffset?: number;
	paths: string[];
	userId: string;
	workspaceId: string;
}

export interface WorkspaceKernelAiReadItem {
	content?: string;
	page?: WorkspaceKernelAiContentPage;
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

		try {
			result.items.push(
				await readWorkspaceKernelAiItem({
					contentLimit: input.contentLimit,
					contentOffset: input.contentOffset,
					item: resolution.item,
					kernel: context.kernel,
					path: resolution.path,
				}),
			);
		} catch (error) {
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
	path: string;
}): Promise<WorkspaceKernelAiReadItem> {
	const { item } = input;

	if (item.type === "folder") {
		throw new Error("Folder paths should be handled before item reads.");
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
	path: string;
}): Promise<WorkspaceKernelAiReadItem> {
	const { item } = input;
	const fileType = resolveWorkspaceFileTypeFromItem(item);

	if (!fileType) {
		return {
			path: input.path,
			status: "unsupported",
			type: "file",
		};
	}

	if (fileType.aiReadStrategy !== "markdown_extraction") {
		return {
			path: input.path,
			status: "unsupported",
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
			...(page.page ? { page: page.page } : {}),
			path: input.path,
			status: "ready",
			type: "file",
		};
	}

	return {
		path: input.path,
		status: getFileReadStatus(projection),
		type: "file",
	};
}

function isReadableProjectionStatus(
	status: WorkspaceKernelFileProjectionStatus,
) {
	return status === "ready";
}

function getFileReadStatus(
	projection: ReadWorkspaceKernelFileProjectionResult | null,
): WorkspaceKernelAiReadItem["status"] {
	if (!projection) {
		return "pending";
	}

	if (projection.status === "queued" || projection.status === "processing") {
		return "pending";
	}

	if (projection.status === "ready") {
		return "failed";
	}

	return projection.status === "failed" ? "failed" : "pending";
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
