import {
	FileText,
	Folder,
	Layers3,
	ListChecks,
	type LucideIcon,
	Paperclip,
} from "lucide-react";

import type { WorkspaceItemType } from "#/features/workspaces/contracts";
import {
	workspaceFileAssetKinds,
	workspaceFileUploadTypeLabel,
} from "#/features/workspaces/model/workspace-file-upload-policy";

export type WorkspaceItemCapability =
	| "view"
	| "edit_text"
	| "edit_rich_text"
	| "edit_structured"
	| "extract_text"
	| "ocr"
	| "transcribe"
	| "convert"
	| "index"
	| "ai_read"
	| "ai_edit"
	| "collaborate"
	| "run_in_sandbox";

export type WorkspaceItemFamily = "container" | "native" | "file";
export type WorkspaceItemCreateGroup = "primary" | "learn";
export type WorkspaceItemRealtimeModel =
	| "workspace-events"
	| "item-room-when-open"
	| "none";

export type WorkspaceItemCardPreview = "fill" | "icon";

export interface WorkspaceItemRegistryEntry {
	type: WorkspaceItemType;
	family: WorkspaceItemFamily;
	label: string;
	menuLabel: string;
	menuDescription?: string;
	menuGroup: WorkspaceItemCreateGroup;
	creatable: boolean;
	icon: LucideIcon;
	cardPreview: WorkspaceItemCardPreview;
	viewer: string;
	editor?: string;
	storage: readonly string[];
	contentFormats: readonly string[];
	assetFamilies: readonly string[];
	capabilities: readonly WorkspaceItemCapability[];
	realtime: WorkspaceItemRealtimeModel;
}

export const workspaceObjectRegistry = {
	folder: {
		type: "folder",
		family: "container",
		label: "Folder",
		menuLabel: "Folder",
		menuGroup: "primary",
		creatable: true,
		icon: Folder,
		cardPreview: "icon",
		viewer: "folder",
		storage: ["workspace_kernel.items"],
		contentFormats: [],
		assetFamilies: [],
		capabilities: ["view"],
		realtime: "workspace-events",
	},
	document: {
		type: "document",
		family: "native",
		label: "Document",
		menuLabel: "Document",
		menuGroup: "primary",
		creatable: true,
		icon: FileText,
		cardPreview: "fill",
		viewer: "document",
		editor: "tiptap-document",
		storage: ["workspace_kernel.items", "workspace_kernel.snapshots"],
		contentFormats: ["document_json"],
		assetFamilies: [],
		capabilities: ["view", "edit_rich_text", "index", "ai_read", "ai_edit"],
		realtime: "item-room-when-open",
	},
	file: {
		type: "file",
		family: "file",
		label: "File",
		menuLabel: "Upload file",
		menuDescription: workspaceFileUploadTypeLabel,
		menuGroup: "primary",
		creatable: false,
		icon: Paperclip,
		cardPreview: "fill",
		viewer: "file-router",
		storage: [
			"workspace_kernel.items",
			"workspace_kernel.assets",
			"workspace_kernel.snapshots",
		],
		contentFormats: ["pdf", "image", "markdown", "transcript_json"],
		assetFamilies: workspaceFileAssetKinds,
		capabilities: ["view", "index", "ai_read"],
		realtime: "workspace-events",
	},
	flashcard: {
		type: "flashcard",
		family: "native",
		label: "Flashcard deck",
		menuLabel: "Flashcards",
		menuGroup: "learn",
		creatable: true,
		icon: Layers3,
		cardPreview: "icon",
		viewer: "flashcard-deck",
		editor: "flashcard-editor",
		storage: ["workspace_kernel.items", "workspace_kernel.snapshots"],
		contentFormats: ["flashcard_json"],
		assetFamilies: [],
		capabilities: ["view", "edit_structured", "index", "ai_read", "ai_edit"],
		realtime: "workspace-events",
	},
	quiz: {
		type: "quiz",
		family: "native",
		label: "Quiz",
		menuLabel: "Quiz",
		menuGroup: "learn",
		creatable: true,
		icon: ListChecks,
		cardPreview: "icon",
		viewer: "quiz",
		editor: "quiz-editor",
		storage: ["workspace_kernel.items", "workspace_kernel.snapshots"],
		contentFormats: ["quiz_json"],
		assetFamilies: [],
		capabilities: ["view", "edit_structured", "index", "ai_read", "ai_edit"],
		realtime: "workspace-events",
	},
} satisfies Record<WorkspaceItemType, WorkspaceItemRegistryEntry>;

export function getWorkspaceObjectRegistryEntry(type: WorkspaceItemType) {
	return workspaceObjectRegistry[type];
}

export function workspaceItemUsesFillPreview(
	itemOrType: { type: WorkspaceItemType } | WorkspaceItemType,
) {
	const type = typeof itemOrType === "string" ? itemOrType : itemOrType.type;

	return workspaceObjectRegistry[type].cardPreview === "fill";
}

export const workspaceObjectRegistryEntries: WorkspaceItemRegistryEntry[] =
	Object.values(workspaceObjectRegistry);

export const creatableWorkspaceObjectEntries =
	workspaceObjectRegistryEntries.filter((entry) => entry.creatable);
