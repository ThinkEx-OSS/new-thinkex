import {
	getWorkspaceKernelAiPageContext,
	resolveWorkspaceKernelAiPath,
} from "#/features/workspaces/ai/workspace-kernel-ai-common";
import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
import { serializeTiptapDocumentToMarkdown } from "#/features/workspaces/documents/document-markdown";
import { parseTiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document";
import type { WorkspaceKernelClient } from "#/features/workspaces/kernel/workspace-kernel-access";
import type { ListWorkspaceKernelItemsResult } from "#/features/workspaces/kernel/workspace-kernel-list";
import { listWorkspaceKernelPageItems } from "#/features/workspaces/kernel/workspace-kernel-list";
import type {
	ReadWorkspaceKernelFileProjectionResult,
	WorkspaceKernelFileProjectionStatus,
} from "#/features/workspaces/kernel/workspace-kernel-types";
import {
	getMetadataNumber,
	getMetadataString,
	resolveWorkspaceFileTypeFromItem,
} from "#/features/workspaces/model/workspace-file";

interface WorkspaceKernelAiFileExtraction {
	errorMessage?: string | null;
	reason: WorkspaceKernelAiFileExtractionReason;
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
			metadata: {
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
	failures: WorkspaceKernelAiReadFailure[];
	items: WorkspaceKernelAiReadItem[];
}

const DEFAULT_AI_READ_CONTENT_LIMIT = 2000;
const MAX_AI_READ_CONTENT_LINES = 2000;
const MAX_AI_READ_LINE_LENGTH = 2000;
const TRUNCATED_LINE_SUFFIX = `... (line truncated to ${MAX_AI_READ_LINE_LENGTH} chars)`;

type WorkspaceKernelAiReadFailureCode =
	| "content_offset_out_of_range"
	| "path_not_absolute"
	| "path_not_found";

type WorkspaceKernelAiFileExtractionReason =
	| "extracted_markdown_needs_review"
	| "extracted_markdown_needs_review_but_content_missing"
	| "extracted_markdown_ready"
	| "extracted_markdown_ready_but_content_missing"
	| "extraction_failed"
	| "extraction_not_started"
	| "extraction_processing_try_again_later"
	| "extraction_queued_try_again_later"
	| "no_text_projection_available"
	| "unsupported_file_type";

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
		failures: [],
		items: [],
	};

	for (const [index, path] of input.paths.entries()) {
		const resolution = resolveWorkspaceKernelAiPath({
			path,
			tree: context.tree,
		});

		if (resolution.status === "invalid_path") {
			result.failures.push({
				code: resolution.code,
				index,
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
					pageItems: context.pageItems,
					path: resolution.path,
					recursive: input.recursive ?? false,
				}),
			);
		} catch (error) {
			if (error instanceof WorkspaceAiContentPageError) {
				result.failures.push({
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
				reason: getReadableProjectionReason(projection.status),
				status: projection.status,
			},
			metadata,
			...(page.page ? { page: page.page } : {}),
			path: input.path,
			title: item.name,
			type: "file",
		};
	}

	return {
		extraction: getFileExtractionStatus(projection),
		metadata,
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

function getReadableProjectionReason(
	status: Extract<
		WorkspaceKernelFileProjectionStatus,
		"needs_review" | "ready"
	>,
): WorkspaceKernelAiFileExtractionReason {
	return status === "needs_review"
		? "extracted_markdown_needs_review"
		: "extracted_markdown_ready";
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
	constructor(readonly code: "content_offset_out_of_range") {
		super(code);
	}
}
