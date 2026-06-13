import type { Workspace as ShellWorkspace } from "@cloudflare/shell";

import type {
	JsonValue,
	WorkspaceItemSummary,
} from "#/features/workspaces/contracts";
import type { WorkspaceKernelEventBus } from "#/features/workspaces/kernel/workspace-kernel-events";
import { getWorkspaceKernelFileShellPath } from "#/features/workspaces/kernel/workspace-kernel-files";
import type { WorkspaceKernelSql } from "#/features/workspaces/kernel/workspace-kernel-schema";
import type { WorkspaceKernelStore } from "#/features/workspaces/kernel/workspace-kernel-store";
import type { CreateWorkspaceKernelFileFromUploadArgs } from "#/features/workspaces/kernel/workspace-kernel-types";
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
				NULL,
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
}

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
		projections: {
			markdown: {
				status: "not_started",
			},
			text: {
				status: "not_started",
			},
		},
	};
}
