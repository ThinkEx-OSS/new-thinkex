import type { WorkspaceItem } from "#/features/workspaces/model/types";

export function isWorkspacePdfItem(item: WorkspaceItem) {
	if (item.type !== "file") {
		return false;
	}

	const assetFamily = getMetadataString(item, "assetFamily");
	const mimeType = getMetadataString(item, "mimeType");

	return assetFamily === "pdf" || mimeType === "application/pdf";
}

function getMetadataString(item: WorkspaceItem, key: string) {
	const value = item.metadataJson[key];

	return typeof value === "string" ? value : null;
}
