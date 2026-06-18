import type { JsonValue } from "#/features/workspaces/contracts";
import { normalizeWorkspaceItemName } from "#/features/workspaces/defaults";

export type WorkspaceFileAssetKind = "pdf" | "image";

export type WorkspaceFileAiReadStrategy =
	| "markdown_extraction"
	| "metadata_only";

export interface WorkspaceFileExtension {
	ext: string;
	mime: string;
}

export interface WorkspaceFileTypeDescriptor {
	assetKind: WorkspaceFileAssetKind;
	label: string;
	pluralLabel: string;
	extensions: readonly WorkspaceFileExtension[];
	contentTypePrefix?: string;
	defaultFileName: string;
	aiReadStrategy: WorkspaceFileAiReadStrategy;
	requiresHeavyViewerRuntime: boolean;
}

export interface WorkspaceFileItemLike {
	type: string;
	name: string;
	metadataJson: Record<string, JsonValue>;
}

interface WorkspaceFileUploadHint {
	fileName: string;
	contentType?: string | null;
}

export const workspaceFileUploadMaxBytes = 25 * 1024 * 1024;

const workspaceFileTypes: readonly WorkspaceFileTypeDescriptor[] = [
	{
		assetKind: "pdf",
		label: "PDF",
		pluralLabel: "PDFs",
		extensions: [{ ext: "pdf", mime: "application/pdf" }],
		defaultFileName: "Uploaded file.pdf",
		aiReadStrategy: "markdown_extraction",
		requiresHeavyViewerRuntime: true,
	},
	{
		assetKind: "image",
		label: "image",
		pluralLabel: "images",
		extensions: [
			{ ext: "png", mime: "image/png" },
			{ ext: "jpg", mime: "image/jpeg" },
			{ ext: "jpeg", mime: "image/jpeg" },
			{ ext: "gif", mime: "image/gif" },
			{ ext: "webp", mime: "image/webp" },
			{ ext: "svg", mime: "image/svg+xml" },
		],
		contentTypePrefix: "image/",
		defaultFileName: "Uploaded image.png",
		aiReadStrategy: "metadata_only",
		requiresHeavyViewerRuntime: false,
	},
];

export const workspaceFileAssetKinds = workspaceFileTypes.map(
	(descriptor) => descriptor.assetKind,
);

export const workspaceFileUploadAccept = workspaceFileTypes
	.flatMap((descriptor) => [
		...descriptor.extensions.map((extension) => extension.mime),
		...(descriptor.contentTypePrefix
			? [`${descriptor.contentTypePrefix}*`]
			: []),
		...new Set(descriptor.extensions.map((extension) => `.${extension.ext}`)),
	])
	.join(",");

export const workspaceFileUploadTypeLabel =
	formatUploadTypeLabel(workspaceFileTypes);

interface WorkspaceFileUploadValidationError {
	code: "UNSUPPORTED_FILE_TYPE" | "UPLOAD_TOO_LARGE";
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

const unsupportedFileMessage = `Only ${workspaceFileUploadTypeLabel} are supported right now.`;

export function getWorkspaceFileContentUrl(
	workspaceId: string,
	itemId: string,
) {
	return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/files/${encodeURIComponent(itemId)}/content`;
}

export function getWorkspaceFileUploadValidationError(input: {
	fileName: string;
	sizeBytes: number;
	contentType?: string | null;
}): WorkspaceFileUploadValidationError | null {
	if (!resolveWorkspaceFileTypeFromHint(input)) {
		return {
			code: "UNSUPPORTED_FILE_TYPE",
			message: unsupportedFileMessage,
			status: 400,
		};
	}

	if (
		!Number.isInteger(input.sizeBytes) ||
		input.sizeBytes <= 0 ||
		input.sizeBytes > workspaceFileUploadMaxBytes
	) {
		return {
			code: "UPLOAD_TOO_LARGE",
			message: "File upload size is outside the supported limit.",
			status: 413,
		};
	}

	return null;
}

export function requireWorkspaceFileTypeFromHint(
	input: WorkspaceFileUploadHint,
): WorkspaceFileTypeDescriptor {
	const descriptor = resolveWorkspaceFileTypeFromHint(input);

	if (!descriptor) {
		throw new WorkspaceFileUploadError({
			code: "UNSUPPORTED_FILE_TYPE",
			message: unsupportedFileMessage,
			status: 400,
		});
	}

	return descriptor;
}

export function normalizeWorkspaceUploadFileName(
	fileName: string,
	descriptor: WorkspaceFileTypeDescriptor,
) {
	const name = normalizeWorkspaceItemName(
		fileName.split(/[\\/]/).at(-1),
		descriptor.defaultFileName,
	);
	const matchedExtension = findExtension(descriptor, {
		fileName: name,
	});

	if (matchedExtension) {
		return name;
	}

	const baseName = stripFileExtension(name);

	return `${baseName}.${descriptor.extensions[0].ext}`;
}

export function workspaceItemRequiresHeavyViewerRuntime(
	item: WorkspaceFileItemLike,
) {
	return (
		resolveWorkspaceFileTypeFromItem(item)?.requiresHeavyViewerRuntime ?? false
	);
}

export function resolveWorkspaceFileTypeFromHint(
	input: WorkspaceFileUploadHint,
): WorkspaceFileTypeDescriptor | null {
	const fileName = input.fileName.trim().toLowerCase();
	const contentType = input.contentType?.trim().toLowerCase() ?? null;

	return (
		workspaceFileTypes.find(
			(descriptor) =>
				Boolean(findExtension(descriptor, { contentType, fileName })) ||
				(contentType !== null &&
					descriptor.contentTypePrefix !== undefined &&
					contentType.startsWith(descriptor.contentTypePrefix)),
		) ?? null
	);
}

export function resolveWorkspaceFileTypeFromItem(
	item: WorkspaceFileItemLike,
): WorkspaceFileTypeDescriptor | null {
	if (item.type !== "file") {
		return null;
	}

	const hint = resolveWorkspaceFileTypeFromHint({
		fileName: item.name,
		contentType: getMetadataString(item.metadataJson, "mimeType"),
	});

	if (hint) {
		return hint;
	}

	const assetFamily = getMetadataString(item.metadataJson, "assetFamily");

	if (!assetFamily) {
		return null;
	}

	return (
		workspaceFileTypes.find(
			(descriptor) => descriptor.assetKind === assetFamily,
		) ?? null
	);
}

export function getWorkspaceFileShellExtension(input: {
	fileName: string;
	contentType?: string | null;
	descriptor: WorkspaceFileTypeDescriptor;
}) {
	const matchedExtension = findExtension(input.descriptor, input);

	if (matchedExtension) {
		return matchedExtension.ext;
	}

	const contentType = input.contentType?.trim().toLowerCase() ?? null;

	if (
		contentType &&
		input.descriptor.contentTypePrefix &&
		contentType.startsWith(input.descriptor.contentTypePrefix)
	) {
		const subtype = contentType.slice(
			input.descriptor.contentTypePrefix.length,
		);

		if (subtype === "svg+xml") {
			return "svg";
		}

		if (subtype && /^[a-z0-9.+-]+$/.test(subtype)) {
			return subtype;
		}
	}

	return input.descriptor.extensions[0]?.ext ?? "bin";
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
		findExtension(input.descriptor, input)?.mime ??
		input.descriptor.extensions[0]?.mime ??
		"application/octet-stream"
	);
}

function stripFileExtension(fileName: string) {
	const lastDot = fileName.lastIndexOf(".");

	if (lastDot <= 0) {
		return fileName;
	}

	return fileName.slice(0, lastDot);
}

function findExtension(
	descriptor: WorkspaceFileTypeDescriptor,
	input: WorkspaceFileUploadHint,
) {
	const fileName = input.fileName.trim().toLowerCase();
	const contentType = input.contentType?.trim().toLowerCase() ?? null;

	for (const extension of descriptor.extensions) {
		if (fileName.endsWith(`.${extension.ext}`)) {
			return extension;
		}
	}

	if (!contentType) {
		return null;
	}

	return (
		descriptor.extensions.find((extension) => extension.mime === contentType) ??
		null
	);
}

function getMetadataString(metadata: Record<string, JsonValue>, key: string) {
	const value = metadata[key];

	return typeof value === "string" ? value : null;
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
