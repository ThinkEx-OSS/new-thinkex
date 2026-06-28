import type {
	JsonValue,
	WorkspaceColor,
	WorkspaceIcon,
	WorkspaceMembershipRole,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import type { BackfillWorkspaceKernelMigrationVisualsResult } from "#/features/workspaces/kernel/workspace-kernel-types";
import type { WorkspaceFileAssetKind } from "#/features/workspaces/model/workspace-file";

export interface ThinkexMigrationImportUserInput {
	accountId: string;
	accountCreatedAt: string;
	accountUpdatedAt: string;
	createdAt: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
	name: string;
	updatedAt: string;
	userId: string;
}

export interface ThinkexMigrationImportWorkspaceInput {
	color?: string | null;
	createdAt: string;
	description?: string | null;
	icon?: string | null;
	lastOpenedAt?: string | null;
	legacyWorkspaceId: string;
	name: string;
	ownerUserId: string;
	updatedAt: string;
	workspaceId: string;
}

export interface ThinkexMigrationImportWorkspaceMemberInput {
	createdAt: string;
	lastOpenedAt?: string | null;
	role: WorkspaceMembershipRole;
	userId: string;
	workspaceId: string;
}

export interface ThinkexMigrationImportDocumentItemInput {
	color?: string | null;
	content: string;
	createdAt: string;
	itemId: string;
	name: string;
	parentId?: string | null;
	sortOrder: number;
	updatedAt: string;
	workspaceId: string;
}

export interface ThinkexMigrationImportFolderItemInput {
	color?: string | null;
	createdAt: string;
	itemId: string;
	name: string;
	parentId?: string | null;
	sortOrder: number;
	updatedAt: string;
	workspaceId: string;
}

export interface ThinkexMigrationImportFileItemInput {
	assetKind: WorkspaceFileAssetKind;
	contentType: string;
	createdAt: string;
	itemId: string;
	name: string;
	ocrPages?: string | null;
	ocrSourceHash?: string | null;
	originalName: string;
	parentId?: string | null;
	sizeBytes: number;
	sortOrder: number;
	updatedAt: string;
	workspaceId: string;
}

export interface ThinkexMigrationSkipItemResult {
	itemId: string;
	reason: string;
	workspaceId: string;
}

export interface ThinkexMigrationImportWorkspaceResult {
	workspace: WorkspaceSummary;
}

export interface ThinkexMigrationListBackfillWorkspacesInput {
	limit?: number;
	offset?: number;
}

export interface ThinkexMigrationListBackfillWorkspacesResult {
	total: number;
	workspaceIds: string[];
}

export interface ThinkexMigrationBackfillVisualsInput {
	dryRun?: boolean;
	workspaceId: string;
}

export interface ThinkexMigrationBackfillVisualsResult extends BackfillWorkspaceKernelMigrationVisualsResult {
	workspaceColor: {
		after: WorkspaceColor | null;
		before: string | null;
		updated: boolean;
	};
	workspaceIcon: {
		after: WorkspaceIcon | null;
		before: string | null;
		updated: boolean;
	};
	workspaceId: string;
}

export interface ThinkexMigrationCommandEnvelope {
	command:
		| { type: "import_user"; input: ThinkexMigrationImportUserInput }
		| { type: "import_workspace"; input: ThinkexMigrationImportWorkspaceInput }
		| { type: "import_workspace_member"; input: ThinkexMigrationImportWorkspaceMemberInput }
		| { type: "import_folder_item"; input: ThinkexMigrationImportFolderItemInput }
		| { type: "import_document_item"; input: ThinkexMigrationImportDocumentItemInput }
		| { type: "import_file_item"; input: ThinkexMigrationImportFileItemInput }
		| {
				type: "list_migration_backfill_workspaces";
				input?: ThinkexMigrationListBackfillWorkspacesInput;
		  }
		| { type: "backfill_migration_visuals"; input: ThinkexMigrationBackfillVisualsInput };
}

export interface ThinkexMigrationImportedFileProjectionMetadata extends Record<string, JsonValue> {
	legacyFormat: "thinkex_ocr_pages_v1";
	pageCount: number;
}
