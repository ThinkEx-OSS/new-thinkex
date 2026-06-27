import type { JsonValue } from "#/features/workspaces/contracts";
import {
	type WorkspaceDocumentImportFormat,
	workspaceDocumentImportFormats,
} from "#/features/workspaces/upload/document-importers";
import {
	workspaceFileUploadLimits,
	workspaceFileUploadFormats,
	resolveWorkspaceFileTypeFromHint,
	type WorkspaceFileTypeDescriptor,
	type WorkspaceFileUploadHint,
	type WorkspaceFileUploadValidationError,
} from "#/features/workspaces/model/workspace-file";
import {
	getDeniedWorkspaceUploadMessage,
	normalizeUploadContentType,
	normalizeUploadFileName,
} from "#/features/workspaces/upload/matching";

export type WorkspaceUploadPlan =
	| {
			kind: "document";
			importer: WorkspaceDocumentImportFormat;
	  }
	| {
			kind: "file";
			descriptor: WorkspaceFileTypeDescriptor;
	  };

export type WorkspaceUploadDocumentCreateContent = {
	initialContent: string;
	metadataJson: Record<string, JsonValue>;
	name: string;
};

export type WorkspaceUploadValidationResult =
	| {
			ok: true;
			plan: WorkspaceUploadPlan;
	  }
	| {
			error: WorkspaceFileUploadValidationError;
			ok: false;
	  };

export const workspaceUploadAccept = [
	...new Set([
		...workspaceFileUploadFormats.flatMap((format) => [format.mime, `.${format.ext}`]),
		...workspaceDocumentImportFormats.flatMap((format) => [
			...format.mimes,
			...format.extensions.map((extension) => `.${extension}`),
		]),
	]),
].join(",");

export const workspaceUploadTypeLabel =
	"PDFs, Word documents, PowerPoint presentations, images, CSV, TSV, Markdown, code, or text files";

const unsupportedUploadMessage = `Only ${workspaceUploadTypeLabel} are supported right now.`;

export function resolveWorkspaceUploadPlan(
	input: WorkspaceFileUploadHint,
): WorkspaceUploadPlan | null {
	const documentImporter = resolveWorkspaceDocumentImporter(input);

	if (documentImporter) {
		return { kind: "document", importer: documentImporter };
	}

	const descriptor = resolveWorkspaceFileTypeFromHint(input);

	return descriptor ? { kind: "file", descriptor } : null;
}

export function getWorkspaceUploadValidationError(input: {
	fileName: string;
	sizeBytes: number;
	contentType?: string | null;
}): WorkspaceFileUploadValidationError | null {
	const result = validateWorkspaceUpload(input);

	return result.ok ? null : result.error;
}

export function validateWorkspaceUpload(input: {
	fileName: string;
	sizeBytes: number;
	contentType?: string | null;
}): WorkspaceUploadValidationResult {
	const deniedMessage = getDeniedWorkspaceUploadMessage(input);

	if (deniedMessage) {
		return {
			error: {
				code: "UNSUPPORTED_FILE_TYPE",
				message: deniedMessage,
				status: 400,
			},
			ok: false,
		};
	}

	const plan = resolveWorkspaceUploadPlan(input);

	if (!plan) {
		return {
			error: {
				code: "UNSUPPORTED_FILE_TYPE",
				message: unsupportedUploadMessage,
				status: 400,
			},
			ok: false,
		};
	}

	if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
		return {
			error: {
				code: "INVALID_UPLOAD",
				message: "File upload is empty.",
				status: 400,
			},
			ok: false,
		};
	}

	if (input.sizeBytes > workspaceFileUploadLimits.maxBytesPerFile) {
		return {
			error: {
				code: "UPLOAD_TOO_LARGE",
				message: "File upload size is outside the supported limit.",
				status: 413,
			},
			ok: false,
		};
	}

	return { ok: true, plan };
}

export function getWorkspaceUploadBatchValidationError(input: {
	file: File;
	acceptedCount: number;
	batchBytes: number;
}): WorkspaceFileUploadValidationError | null {
	if (input.acceptedCount >= workspaceFileUploadLimits.maxFilesPerBatch) {
		return {
			code: "TOO_MANY_FILES",
			message: `Upload batches are limited to ${workspaceFileUploadLimits.maxFilesPerBatch} files.`,
			status: 400,
		};
	}

	const validationError = getWorkspaceUploadValidationError({
		fileName: input.file.name,
		sizeBytes: input.file.size,
		contentType: input.file.type,
	});

	if (validationError) {
		return validationError;
	}

	if (input.batchBytes + input.file.size > workspaceFileUploadLimits.maxBytesPerBatch) {
		return {
			code: "BATCH_TOO_LARGE",
			message: "This file would exceed the batch upload size limit.",
			status: 413,
		};
	}

	return null;
}

export function partitionWorkspaceUploadBatch(files: readonly File[]) {
	const accepted: File[] = [];
	const rejected: Array<{ file: File; message: string }> = [];
	let batchBytes = 0;

	for (const file of files) {
		const validationError = getWorkspaceUploadBatchValidationError({
			file,
			acceptedCount: accepted.length,
			batchBytes,
		});

		if (validationError) {
			rejected.push({ file, message: validationError.message });
			continue;
		}

		batchBytes += file.size;
		accepted.push(file);
	}

	return { accepted, rejected };
}

export function uploadPlanCreatesDocument(input: WorkspaceFileUploadHint) {
	return resolveWorkspaceUploadPlan(input)?.kind === "document";
}

export async function createDocumentContentFromWorkspaceUpload(input: {
	file: File;
	plan: Extract<WorkspaceUploadPlan, { kind: "document" }>;
}): Promise<WorkspaceUploadDocumentCreateContent> {
	return input.plan.importer.importFile(input.file);
}

function resolveWorkspaceDocumentImporter(
	input: WorkspaceFileUploadHint,
): WorkspaceDocumentImportFormat | null {
	const fileName = normalizeUploadFileName(input.fileName);
	const formatByExtension = workspaceDocumentImportFormats.find((format) =>
		format.extensions.some((extension) => fileName.endsWith(`.${extension}`)),
	);

	if (formatByExtension) {
		return formatByExtension;
	}

	const formatByFileName = workspaceDocumentImportFormats.find(
		(format) =>
			format.fileNames.some((candidate) => candidate === fileName) ||
			format.matchesFileName?.(fileName),
	);

	if (formatByFileName) {
		return formatByFileName;
	}

	const contentType = normalizeUploadContentType(input.contentType);

	if (contentType) {
		const formatByMime = workspaceDocumentImportFormats.find((format) =>
			format.mimes.includes(contentType),
		);

		if (formatByMime) {
			return formatByMime;
		}
	}

	return null;
}
