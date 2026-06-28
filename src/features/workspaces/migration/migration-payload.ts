import type { JsonValue, WorkspaceColor, WorkspaceIcon } from "#/features/workspaces/contracts";
import type { WorkspaceFileAssetKind } from "#/features/workspaces/model/workspace-file/types.ts";
import type { LegacyOcrPage } from "#/features/workspaces/migration/legacy-ocr-pages.ts";

export interface MigrationPayload {
	user: MigrationUser;
	account: MigrationAccount;
	workspaces: MigrationWorkspace[];
}

export interface MigrationUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface MigrationAccount {
	id: string;
	accountId: string;
	providerId: "google";
	userId: string;
	accessToken: string | null;
	refreshToken: string | null;
	idToken: string | null;
	scope: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface MigrationWorkspace {
	id: string;
	name: string;
	description: string | null;
	icon: WorkspaceIcon;
	color: WorkspaceColor;
	lastOpenedAt: string | null;
	createdAt: string;
	updatedAt: string;
	items: MigrationItem[];
}

export type MigrationItem = MigrationFolderItem | MigrationDocumentItem | MigrationFileItem;

export interface MigrationFolderItem {
	type: "folder";
	id: string;
	name: string;
	parentId: string | null;
	color: WorkspaceColor | null;
	sortOrder: number;
}

export interface MigrationDocumentItem {
	type: "document";
	id: string;
	name: string;
	parentId: string | null;
	sortOrder: number;
	content: string;
	metadataJson: Record<string, JsonValue>;
}

export interface MigrationFileItem {
	type: "file";
	id: string;
	name: string;
	parentId: string | null;
	sortOrder: number;
	assetKind: WorkspaceFileAssetKind;
	fileName: string;
	contentType: string;
	sizeBytes: number;
	bytesBase64: string;
	ocrPages: LegacyOcrPage[] | null;
}
