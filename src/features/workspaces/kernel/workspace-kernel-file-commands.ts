import type { Workspace as ShellWorkspace } from "@cloudflare/shell";

import type {
	JsonValue,
	WorkspaceItemSummary,
} from "#/features/workspaces/contracts";
import type { WorkspaceKernelEventBus } from "#/features/workspaces/kernel/workspace-kernel-events";
import { getWorkspaceKernelFileShellPath } from "#/features/workspaces/kernel/workspace-kernel-files";
import type { WorkspaceKernelSql } from "#/features/workspaces/kernel/workspace-kernel-schema";
import type { WorkspaceKernelStore } from "#/features/workspaces/kernel/workspace-kernel-store";
import type {
	CreateWorkspaceKernelFileFromUploadArgs,
	ReadWorkspaceKernelFileContentArgs,
	ReadWorkspaceKernelFileContentResult,
	ReadWorkspaceKernelFileProjectionArgs,
	ReadWorkspaceKernelFileProjectionResult,
	UpsertWorkspaceKernelFileProjectionArgs,
	WorkspaceKernelFileProjectionFormat,
	WorkspaceKernelFileProjectionStatus,
} from "#/features/workspaces/kernel/workspace-kernel-types";
import { getRandomWorkspaceColor } from "#/features/workspaces/model/workspace-colors";
import type { WorkspaceCommandResult } from "#/features/workspaces/realtime/messages";
import {
	getWorkspaceFileTypeForUpload,
	getWorkspaceFileUploadValidationError,
	normalizeWorkspaceUploadFileName,
	type WorkspaceFileTypeDescriptor,
	WorkspaceFileUploadError,
} from "#/features/workspaces/workspace-file-uploads";

export class WorkspaceKernelFileCommands {
	private readonly events: WorkspaceKernelEventBus;
	private readonly r2: R2Bucket;
	private readonly sql: WorkspaceKernelSql;
	private readonly store: WorkspaceKernelStore;
	private readonly workspace: ShellWorkspace;

	constructor(input: {
		events: WorkspaceKernelEventBus;
		r2: R2Bucket;
		sql: WorkspaceKernelSql;
		store: WorkspaceKernelStore;
		workspace: ShellWorkspace;
	}) {
		this.events = input.events;
		this.r2 = input.r2;
		this.sql = input.sql;
		this.store = input.store;
		this.workspace = input.workspace;
	}

	async createFileFromUpload(
		input: CreateWorkspaceKernelFileFromUploadArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		const parentId = input.parentId ?? null;
		const validationError = getWorkspaceFileUploadValidationError({
			fileName: input.fileName,
			sizeBytes: input.fileSize,
			contentType: input.contentType,
		});

		if (validationError) {
			throw new WorkspaceFileUploadError(validationError);
		}

		this.store.assertParentIsValid(parentId);

		const object = await this.r2.get(input.objectKey);

		if (!object) {
			throw new Error("Uploaded file was not found.");
		}

		if (object.size !== input.fileSize) {
			throw new Error("Uploaded file size did not match the upload request.");
		}

		const bytes = new Uint8Array(await object.arrayBuffer());
		const descriptor = getWorkspaceFileTypeForUpload({
			fileName: input.fileName,
			contentType: input.contentType,
		});

		const now = Date.now();
		const itemId = crypto.randomUUID();
		const color = getRandomWorkspaceColor();
		const requestedName = normalizeWorkspaceUploadFileName(
			input.fileName,
			descriptor,
		);
		const name = this.store.getAvailableItemName({
			type: "file",
			parentId,
			requestedName,
		});
		const shellPath = getWorkspaceKernelFileShellPath({
			itemId,
			extension: descriptor.shellExtension,
		});
		const metadataJson = createFileMetadata({
			descriptor,
			originalName: requestedName,
			sizeBytes: bytes.byteLength,
		});

		await this.workspace.writeFileBytes(
			shellPath,
			bytes,
			descriptor.contentType,
		);
		await this.r2.delete(input.objectKey);

		this.sql`
			INSERT INTO kernel_items (
				id,
				parent_id,
				type,
				name,
				color,
				metadata_json,
				sort_order,
				shell_path,
				created_at,
				updated_at,
				deleted_at
			)
			VALUES (
				${itemId},
				${parentId},
				${"file"},
				${name},
				${color},
				${JSON.stringify(metadataJson)},
				${this.store.getNextSortOrder(parentId)},
				${shellPath},
				${now},
				${now},
				NULL
			)
		`;

		const item = this.store.requireItem(itemId);
		const event = this.events.commit({
			type: "workspace.item.created",
			actorUserId: input.actorUserId ?? null,
			clientMutationId: input.clientMutationId ?? null,
			payload: { item },
		});

		return { result: item, event };
	}

	async readFileContent(
		input: ReadWorkspaceKernelFileContentArgs,
	): Promise<ReadWorkspaceKernelFileContentResult> {
		const row = this.store.assertActiveItem(input.itemId);

		if (row.type !== "file") {
			throw new Error("Workspace item is not a file.");
		}

		const bytes = await this.workspace.readFileBytes(row.shell_path);

		if (!bytes) {
			throw new Error("Workspace file content was not found.");
		}

		const item = this.store.requireItem(input.itemId);
		const contentType = getMetadataString(item.metadataJson, "mimeType");
		const originalName = getMetadataString(item.metadataJson, "originalName");
		const sizeBytes = getMetadataNumber(item.metadataJson, "sizeBytes");

		return {
			bytes,
			contentType: contentType ?? "application/octet-stream",
			fileName: originalName ?? item.name,
			sizeBytes: sizeBytes ?? bytes.byteLength,
		};
	}

	async upsertFileProjection(
		input: UpsertWorkspaceKernelFileProjectionArgs,
	): Promise<void> {
		const row = this.store.assertActiveItem(input.itemId);

		if (row.type !== "file") {
			throw new Error("Workspace item is not a file.");
		}

		const now = Date.now();

		await this.writeProjectionRow({
			itemId: input.itemId,
			projection: input,
			now,
		});
	}

	private async writeProjectionRow(input: {
		itemId: string;
		projection: UpsertWorkspaceKernelFileProjectionArgs;
		now: number;
	}) {
		const contentShellPath =
			input.projection.content == null
				? this.getExistingProjectionPath({
						itemId: input.itemId,
						format: input.projection.format,
					})
				: getWorkspaceKernelProjectionShellPath({
						itemId: input.itemId,
						format: input.projection.format,
					});

		if (input.projection.content != null) {
			const projectionShellPath = getWorkspaceKernelProjectionShellPath({
				itemId: input.itemId,
				format: input.projection.format,
			});

			await this.workspace.mkdir(`/items/${input.itemId}/projections`, {
				recursive: true,
			});
			await this.workspace.writeFile(
				projectionShellPath,
				input.projection.content,
				getProjectionContentType(),
			);
		}

		this.sql`
			INSERT INTO kernel_item_projections (
				item_id,
				format,
				status,
				provider,
				provider_mode,
				content_shell_path,
				error_message,
				source_hash,
				metadata_json,
				created_at,
				updated_at
			)
			VALUES (
				${input.itemId},
				${input.projection.format},
				${input.projection.status},
				${input.projection.provider ?? null},
				${input.projection.providerMode ?? null},
				${contentShellPath},
				${input.projection.errorMessage ?? null},
				${input.projection.sourceHash ?? null},
				${JSON.stringify(input.projection.metadataJson ?? {})},
				${input.now},
				${input.now}
			)
			ON CONFLICT(item_id, format) DO UPDATE SET
				status = excluded.status,
				provider = excluded.provider,
				provider_mode = excluded.provider_mode,
				content_shell_path = COALESCE(excluded.content_shell_path, kernel_item_projections.content_shell_path),
				error_message = excluded.error_message,
				source_hash = excluded.source_hash,
				metadata_json = excluded.metadata_json,
				updated_at = excluded.updated_at
		`;
	}

	async readFileProjection(
		input: ReadWorkspaceKernelFileProjectionArgs,
	): Promise<ReadWorkspaceKernelFileProjectionResult | null> {
		const row = this.store.assertActiveItem(input.itemId);

		if (row.type !== "file") {
			throw new Error("Workspace item is not a file.");
		}

		const projection = this.getProjectionRow(input);

		if (!projection) {
			return null;
		}

		return {
			itemId: projection.item_id,
			format: projection.format,
			status: projection.status,
			content: projection.content_shell_path
				? await this.workspace.readFile(projection.content_shell_path)
				: null,
			provider: projection.provider,
			providerMode: projection.provider_mode,
			errorMessage: projection.error_message,
			sourceHash: projection.source_hash,
			metadataJson: parseProjectionMetadataJson(projection.metadata_json),
			updatedAt: new Date(projection.updated_at).toISOString(),
		};
	}

	private getExistingProjectionPath(input: {
		itemId: string;
		format: WorkspaceKernelFileProjectionFormat;
	}) {
		return this.getProjectionRow(input)?.content_shell_path ?? null;
	}

	private getProjectionRow(input: {
		itemId: string;
		format: WorkspaceKernelFileProjectionFormat;
	}) {
		return (
			this.sql<KernelItemProjectionRow>`
				SELECT *
				FROM kernel_item_projections
				WHERE item_id = ${input.itemId} AND format = ${input.format}
				LIMIT 1
			`[0] ?? null
		);
	}
}

type KernelItemProjectionRow = {
	item_id: string;
	format: WorkspaceKernelFileProjectionFormat;
	status: WorkspaceKernelFileProjectionStatus;
	provider: string | null;
	provider_mode: string | null;
	content_shell_path: string | null;
	error_message: string | null;
	source_hash: string | null;
	metadata_json: string;
	created_at: number;
	updated_at: number;
};

function createFileMetadata(input: {
	descriptor: WorkspaceFileTypeDescriptor;
	originalName: string;
	sizeBytes: number;
}): Record<string, JsonValue> {
	return {
		assetFamily: input.descriptor.assetKind,
		mimeType: input.descriptor.contentType,
		originalName: input.originalName,
		sizeBytes: input.sizeBytes,
	};
}

function getMetadataString(metadata: Record<string, JsonValue>, key: string) {
	const value = metadata[key];

	return typeof value === "string" ? value : null;
}

function getMetadataNumber(metadata: Record<string, JsonValue>, key: string) {
	const value = metadata[key];

	return typeof value === "number" ? value : null;
}

function getWorkspaceKernelProjectionShellPath(input: {
	itemId: string;
	format: WorkspaceKernelFileProjectionFormat;
}) {
	return `/items/${input.itemId}/projections/${input.format}.md`;
}

function getProjectionContentType() {
	return "text/markdown";
}

function parseProjectionMetadataJson(value: string): Record<string, JsonValue> {
	try {
		const parsed = JSON.parse(value) as unknown;

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}

		return parsed as Record<string, JsonValue>;
	} catch {
		return {};
	}
}
