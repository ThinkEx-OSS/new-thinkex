import type { JsonValue } from "#/features/workspaces/contracts";
import { withDocumentPreviewMetadata } from "#/features/workspaces/documents/document-preview-text";
import { parseWorkspaceItemMetadataJson } from "#/features/workspaces/kernel/workspace-kernel-metadata";
import type { WorkspaceKernelSql } from "#/features/workspaces/kernel/workspace-kernel-schema";

export function prepareDocumentItemMetadata(
	metadataJson: Record<string, JsonValue>,
	content: string,
) {
	return withDocumentPreviewMetadata(metadataJson, content);
}

export function persistDocumentItemContentUpdate(input: {
	content: string;
	itemId: string;
	metadataJson: string;
	sql: WorkspaceKernelSql;
	updatedAt?: number;
}) {
	const metadata = prepareDocumentItemMetadata(
		parseWorkspaceItemMetadataJson(input.metadataJson),
		input.content,
	);
	const updatedAt = input.updatedAt ?? Date.now();

	input.sql`
		UPDATE kernel_items
		SET
			updated_at = ${updatedAt},
			metadata_json = ${JSON.stringify(metadata)}
		WHERE id = ${input.itemId} AND deleted_at IS NULL
	`;
}

export function touchWorkspaceItemUpdatedAt(input: {
	itemId: string;
	sql: WorkspaceKernelSql;
	updatedAt?: number;
}) {
	const updatedAt = input.updatedAt ?? Date.now();

	input.sql`
		UPDATE kernel_items
		SET updated_at = ${updatedAt}
		WHERE id = ${input.itemId} AND deleted_at IS NULL
	`;
}
