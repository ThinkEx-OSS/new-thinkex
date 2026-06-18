import { FileText, Image, type LucideIcon } from "lucide-react";

import { normalizeWorkspaceItemName } from "#/features/workspaces/defaults";
import { workspaceFileUploadLimits } from "#/features/workspaces/model/workspace-file/limits";
import type {
	WorkspaceFileAiReadStrategy,
	WorkspaceFileAssetKind,
	WorkspaceFileExtractionRoute,
	WorkspaceFilePreviewGeneratorId,
} from "#/features/workspaces/model/workspace-file/types";

export interface WorkspaceFileUploadHint {
	fileName: string;
	contentType?: string | null;
}

export interface WorkspaceUploadFormat {
	ext: string;
	mime: string;
	assetKind: WorkspaceFileAssetKind;
	aiReadStrategy?: WorkspaceFileAiReadStrategy;
}

export interface WorkspaceUploadFamily {
	assetKind: WorkspaceFileAssetKind;
	label: string;
	pluralLabel: string;
	icon: LucideIcon;
	defaultFileName: string;
	aiReadStrategy: WorkspaceFileAiReadStrategy;
	requiresHeavyViewerRuntime: boolean;
	previewGenerator: WorkspaceFilePreviewGeneratorId | null;
	extractionRoute: WorkspaceFileExtractionRoute;
}

export interface WorkspaceFileTypeDescriptor extends WorkspaceUploadFamily {
	extensions: readonly { ext: string; mime: string }[];
}

export interface WorkspaceUploadDeniedFormat {
	ext: string;
	mime: string;
	message: string;
}

export type WorkspaceFileUploadValidationErrorCode =
	| "UNSUPPORTED_FILE_TYPE"
	| "UPLOAD_TOO_LARGE"
	| "TOO_MANY_FILES"
	| "BATCH_TOO_LARGE";

export interface WorkspaceFileUploadValidationError {
	code: WorkspaceFileUploadValidationErrorCode;
	message: string;
	status: 400 | 413;
}

export class WorkspaceFileUploadError extends Error {
	readonly code: WorkspaceFileUploadValidationError["code"];
	readonly status: WorkspaceFileUploadValidationError["status"];

	constructor(validationError: WorkspaceFileUploadValidationError) {
		super(validationError.message);
		this.name = "WorkspaceFileUploadError";
		this.code = validationError.code;
		this.status = validationError.status;
	}
}

/**
 * Explicit upload allowlist. Add or remove formats here; everything else is rejected.
 * Do not use broad MIME wildcards (e.g. image/*) — they bypass this list.
 */
const WORKSPACE_UPLOAD_FORMATS = [
	{ ext: "pdf", mime: "application/pdf", assetKind: "pdf" },
	{ ext: "png", mime: "image/png", assetKind: "image" },
	{ ext: "jpg", mime: "image/jpeg", assetKind: "image" },
	{ ext: "jpeg", mime: "image/jpeg", assetKind: "image" },
	{
		ext: "gif",
		mime: "image/gif",
		assetKind: "image",
		aiReadStrategy: "metadata_only",
	},
	{ ext: "webp", mime: "image/webp", assetKind: "image" },
] as const satisfies readonly WorkspaceUploadFormat[];

/**
 * Known formats we reject with a specific message (optional UX layer on top of allowlist).
 */
const WORKSPACE_UPLOAD_DENIED_FORMATS = [
	{
		ext: "svg",
		mime: "image/svg+xml",
		message: "SVG files are not supported.",
	},
] as const satisfies readonly WorkspaceUploadDeniedFormat[];

const WORKSPACE_UPLOAD_FAMILIES = [
	{
		assetKind: "pdf",
		label: "PDF",
		pluralLabel: "PDFs",
		icon: FileText,
		defaultFileName: "Uploaded file.pdf",
		aiReadStrategy: "markdown_extraction",
		requiresHeavyViewerRuntime: true,
		previewGenerator: "pdf_webp",
		extractionRoute: {
			provider: "firecrawl",
			mode: "auto",
			reason: "default_pdf_upload_route",
		},
	},
	{
		assetKind: "image",
		label: "Image",
		pluralLabel: "images",
		icon: Image,
		defaultFileName: "Uploaded image.png",
		aiReadStrategy: "markdown_extraction",
		requiresHeavyViewerRuntime: false,
		previewGenerator: "image_webp",
		extractionRoute: {
			provider: "workers_ai_to_markdown",
			mode: "default",
			reason: "default_image_upload_route",
		},
	},
] as const satisfies readonly WorkspaceUploadFamily[];

const workspaceUploadFamilyByKind: Record<
	WorkspaceFileAssetKind,
	WorkspaceFileTypeDescriptor
> = {
	pdf: {
		...WORKSPACE_UPLOAD_FAMILIES[0],
		extensions: WORKSPACE_UPLOAD_FORMATS.filter(
			(format) => format.assetKind === "pdf",
		).map(({ ext, mime }) => ({ ext, mime })),
	},
	image: {
		...WORKSPACE_UPLOAD_FAMILIES[1],
		extensions: WORKSPACE_UPLOAD_FORMATS.filter(
			(format) => format.assetKind === "image",
		).map(({ ext, mime }) => ({ ext, mime })),
	},
};

export const workspaceFileUploadAccept = [
	...new Set(
		WORKSPACE_UPLOAD_FORMATS.flatMap((format) => [
			format.mime,
			`.${format.ext}`,
		]),
	),
].join(",");

export const workspaceFileUploadTypeLabel = formatUploadTypeLabel(
	Object.values(workspaceUploadFamilyByKind),
);

const unsupportedFileMessage = `Only ${workspaceFileUploadTypeLabel} are supported right now.`;

export function getWorkspaceFileUploadValidationError(input: {
	fileName: string;
	sizeBytes: number;
	contentType?: string | null;
}): WorkspaceFileUploadValidationError | null {
	const deniedMessage = getWorkspaceUploadDeniedMessage(input);

	if (deniedMessage) {
		return {
			code: "UNSUPPORTED_FILE_TYPE",
			message: deniedMessage,
			status: 400,
		};
	}

	if (!resolveWorkspaceUploadFormat(input)) {
		return {
			code: "UNSUPPORTED_FILE_TYPE",
			message: unsupportedFileMessage,
			status: 400,
		};
	}

	if (
		!Number.isInteger(input.sizeBytes) ||
		input.sizeBytes <= 0 ||
		input.sizeBytes > workspaceFileUploadLimits.maxBytesPerFile
	) {
		return {
			code: "UPLOAD_TOO_LARGE",
			message: "File upload size is outside the supported limit.",
			status: 413,
		};
	}

	return null;
}

export function partitionWorkspaceUploadBatch(files: readonly File[]) {
	const accepted: File[] = [];
	const rejected: Array<{ file: File; message: string }> = [];
	let batchBytes = 0;

	for (const [index, file] of files.entries()) {
		if (index >= workspaceFileUploadLimits.maxFilesPerBatch) {
			rejected.push({
				file,
				message: `Upload batches are limited to ${workspaceFileUploadLimits.maxFilesPerBatch} files.`,
			});
			continue;
		}

		const validationError = getWorkspaceFileUploadValidationError({
			fileName: file.name,
			sizeBytes: file.size,
			contentType: file.type,
		});

		if (validationError) {
			rejected.push({ file, message: validationError.message });
			continue;
		}

		if (batchBytes + file.size > workspaceFileUploadLimits.maxBytesPerBatch) {
			rejected.push({
				file,
				message: "This file would exceed the batch upload size limit.",
			});
			continue;
		}

		batchBytes += file.size;
		accepted.push(file);
	}

	return { accepted, rejected };
}

export function requireWorkspaceFileTypeFromHint(
	input: WorkspaceFileUploadHint,
): WorkspaceFileTypeDescriptor {
	const descriptor = resolveWorkspaceFileTypeFromHint(input);

	if (!descriptor) {
		throw new WorkspaceFileUploadError({
			code: "UNSUPPORTED_FILE_TYPE",
			message: getWorkspaceUploadDeniedMessage(input) ?? unsupportedFileMessage,
			status: 400,
		});
	}

	return descriptor;
}

export function resolveWorkspaceUploadFormat(
	input: WorkspaceFileUploadHint,
): WorkspaceUploadFormat | null {
	return (
		WORKSPACE_UPLOAD_FORMATS.find((format) =>
			matchesUploadHint(format, input),
		) ?? null
	);
}

export function resolveWorkspaceFileTypeFromHint(
	input: WorkspaceFileUploadHint,
): WorkspaceFileTypeDescriptor | null {
	const format = resolveWorkspaceUploadFormat(input);

	if (!format) {
		return null;
	}

	return workspaceUploadFamilyByKind[format.assetKind];
}

export function resolveWorkspaceFileAiReadStrategy(input: {
	fileName: string;
	contentType?: string | null;
	descriptor: WorkspaceFileTypeDescriptor;
}): WorkspaceFileAiReadStrategy {
	const format = resolveMatchedUploadFormat(input, input.descriptor);

	return format?.aiReadStrategy ?? input.descriptor.aiReadStrategy;
}

export function getWorkspaceUploadFamily(
	assetKind: WorkspaceFileAssetKind,
): WorkspaceFileTypeDescriptor {
	return workspaceUploadFamilyByKind[assetKind];
}

export function normalizeWorkspaceUploadFileName(
	fileName: string,
	descriptor: WorkspaceFileTypeDescriptor,
) {
	const name = normalizeWorkspaceItemName(
		fileName.split(/[\\/]/).at(-1),
		descriptor.defaultFileName,
	);
	const matchedFormat = resolveMatchedUploadFormat(
		{ fileName: name },
		descriptor,
	);

	if (matchedFormat) {
		return name;
	}

	const baseName = stripFileExtension(name);

	return `${baseName}.${descriptor.extensions[0]?.ext ?? "bin"}`;
}

export function resolveMatchedUploadFormat(
	input: WorkspaceFileUploadHint,
	descriptor: WorkspaceFileTypeDescriptor,
) {
	const format = resolveWorkspaceUploadFormat(input);

	if (!format || format.assetKind !== descriptor.assetKind) {
		return null;
	}

	return format;
}

export function getWorkspaceFileShellExtension(input: {
	fileName: string;
	contentType?: string | null;
	descriptor: WorkspaceFileTypeDescriptor;
}) {
	return (
		resolveMatchedUploadFormat(input, input.descriptor)?.ext ??
		input.descriptor.extensions[0]?.ext ??
		"bin"
	);
}

export function resolveWorkspaceFileContentType(input: {
	contentType?: string | null;
	descriptor: WorkspaceFileTypeDescriptor;
	fileName: string;
}) {
	const normalizedContentType = input.contentType?.trim();

	if (normalizedContentType) {
		return normalizedContentType;
	}

	return (
		resolveMatchedUploadFormat(input, input.descriptor)?.mime ??
		input.descriptor.extensions[0]?.mime ??
		"application/octet-stream"
	);
}

function matchesUploadHint(
	format: Pick<WorkspaceUploadFormat, "ext" | "mime">,
	input: WorkspaceFileUploadHint,
) {
	const fileName = normalizeUploadFileName(input.fileName);
	const contentType = normalizeUploadContentType(input.contentType);

	return (
		fileName.endsWith(`.${format.ext}`) ||
		(contentType !== null && contentType === format.mime)
	);
}

function getWorkspaceUploadDeniedMessage(input: WorkspaceFileUploadHint) {
	const denied = WORKSPACE_UPLOAD_DENIED_FORMATS.find((format) =>
		matchesUploadHint(format, input),
	);

	return denied?.message ?? null;
}

function normalizeUploadFileName(fileName: string) {
	return fileName.trim().toLowerCase();
}

function normalizeUploadContentType(contentType?: string | null) {
	const normalized = contentType?.trim().toLowerCase() ?? null;

	return normalized || null;
}

function stripFileExtension(fileName: string) {
	const lastDot = fileName.lastIndexOf(".");

	if (lastDot <= 0) {
		return fileName;
	}

	return fileName.slice(0, lastDot);
}

function formatUploadTypeLabel(
	descriptors: readonly WorkspaceFileTypeDescriptor[],
) {
	const labels = descriptors.map((descriptor) => descriptor.pluralLabel);

	if (labels.length <= 1) {
		return labels[0] ?? "files";
	}

	if (labels.length === 2) {
		return `${labels[0]} or ${labels[1]}`;
	}

	return `${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}`;
}
