import type { JsonValue } from "#/features/workspaces/contracts";
import type {
	WorkspaceFileAssetKind,
	WorkspaceFileTypeDescriptor,
} from "#/features/workspaces/model/workspace-file-upload-policy";
import {
	getWorkspaceUploadFamily,
	resolveWorkspaceFileTypeFromHint,
} from "#/features/workspaces/model/workspace-file-upload-policy";

export interface WorkspaceFileItemLike {
	type: string;
	name: string;
	metadataJson: Record<string, JsonValue>;
}

export function getWorkspaceFileContentUrl(
	workspaceId: string,
	itemId: string,
) {
	return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/files/${encodeURIComponent(itemId)}/content`;
}

export function getWorkspaceFilePreviewUrl(
	workspaceId: string,
	itemId: string,
) {
	return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/files/${encodeURIComponent(itemId)}/preview`;
}

export function workspaceItemRequiresHeavyViewerRuntime(
	item: WorkspaceFileItemLike,
) {
	return (
		resolveWorkspaceFileTypeFromItem(item)?.requiresHeavyViewerRuntime ?? false
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

	if (!isWorkspaceFileAssetKind(assetFamily)) {
		return null;
	}

	return getWorkspaceUploadFamily(assetFamily);
}

function isWorkspaceFileAssetKind(
	value: string | null,
): value is WorkspaceFileAssetKind {
	return value === "pdf" || value === "image";
}

function getMetadataString(metadata: Record<string, JsonValue>, key: string) {
	const value = metadata[key];

	return typeof value === "string" ? value : null;
}
