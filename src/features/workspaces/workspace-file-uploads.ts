import { normalizeWorkspaceItemName } from "#/features/workspaces/defaults";

export const workspaceFileUploadMaxBytes = 25 * 1024 * 1024;

type WorkspaceFileAssetKind = "pdf";

interface WorkspaceFileUploadDescriptor {
	fileName: string;
	sizeBytes: number;
	contentType?: string | null;
}

interface WorkspaceFileUploadValidationError {
	code: "UNSUPPORTED_FILE_TYPE" | "UPLOAD_TOO_LARGE";
	message: string;
	status: 400 | 413;
}

export interface WorkspaceFileTypeDescriptor {
	assetKind: WorkspaceFileAssetKind;
	label: string;
	pluralLabel: string;
	contentType: string;
	extensions: readonly string[];
	shellExtension: string;
	defaultFileName: string;
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

const workspaceFileTypeDescriptors: readonly WorkspaceFileTypeDescriptor[] = [
	{
		assetKind: "pdf",
		label: "PDF",
		pluralLabel: "PDFs",
		contentType: "application/pdf",
		extensions: [".pdf"],
		shellExtension: "pdf",
		defaultFileName: "Uploaded file.pdf",
	},
];

export const workspaceFileUploadAccept = workspaceFileTypeDescriptors
	.flatMap((descriptor) => [descriptor.contentType, ...descriptor.extensions])
	.join(",");

export const workspaceFileUploadTypeLabel = formatWorkspaceFileUploadTypeLabel(
	workspaceFileTypeDescriptors,
);
const workspaceFileUnsupportedMessage = `Only ${workspaceFileUploadTypeLabel} are supported right now.`;

export function getWorkspaceFileUploadValidationError(
	input: WorkspaceFileUploadDescriptor,
): WorkspaceFileUploadValidationError | null {
	if (!getWorkspaceFileTypeFromHint(input)) {
		return {
			code: "UNSUPPORTED_FILE_TYPE",
			message: workspaceFileUnsupportedMessage,
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

export function getWorkspaceFileTypeForUpload(input: {
	fileName: string;
	contentType?: string | null;
}): WorkspaceFileTypeDescriptor {
	const hintedDescriptor = getWorkspaceFileTypeFromHint(input);

	if (hintedDescriptor) {
		return hintedDescriptor;
	}

	throw new WorkspaceFileUploadError({
		code: "UNSUPPORTED_FILE_TYPE",
		message: workspaceFileUnsupportedMessage,
		status: 400,
	});
}

export function normalizeWorkspaceUploadFileName(
	fileName: string,
	descriptor?: WorkspaceFileTypeDescriptor,
) {
	const fallback = descriptor?.defaultFileName ?? "Uploaded file";
	const name = normalizeWorkspaceItemName(
		fileName.split(/[\\/]/).at(-1),
		fallback,
	);

	if (!descriptor) {
		return name;
	}

	return hasWorkspaceFileExtension(name, descriptor)
		? name
		: `${name}${descriptor.extensions[0]}`;
}

export function formatWorkspaceFileSize(sizeBytes: number) {
	if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
		return "";
	}

	const units = ["B", "KB", "MB", "GB"];
	let value = sizeBytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}

	return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function getWorkspaceFileTypeFromHint(input: {
	fileName: string;
	contentType?: string | null;
}) {
	const normalizedName = input.fileName.trim().toLowerCase();

	return workspaceFileTypeDescriptors.find(
		(descriptor) =>
			descriptor.contentType === input.contentType ||
			descriptor.extensions.some((extension) =>
				normalizedName.endsWith(extension),
			),
	);
}

function hasWorkspaceFileExtension(
	fileName: string,
	descriptor: WorkspaceFileTypeDescriptor,
) {
	const normalizedName = fileName.trim().toLowerCase();

	return descriptor.extensions.some((extension) =>
		normalizedName.endsWith(extension),
	);
}

function formatWorkspaceFileUploadTypeLabel(
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
