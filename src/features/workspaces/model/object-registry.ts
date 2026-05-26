import {
	FileText,
	Folder,
	Layers3,
	ListChecks,
	type LucideIcon,
	Paperclip,
} from "lucide-react";

import type { WorkspaceItemType } from "#/features/workspaces/contracts";

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

export interface WorkspaceItemRegistryEntry {
	type: WorkspaceItemType;
	family: WorkspaceItemFamily;
	label: string;
	menuLabel: string;
	menuDescription?: string;
	menuGroup: WorkspaceItemCreateGroup;
	creatable: boolean;
	icon: LucideIcon;
	iconClassName: string;
	surfaceClassName: string;
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
		iconClassName: "text-amber-600 dark:text-amber-400",
		surfaceClassName: "bg-amber-500/10 dark:bg-amber-500/15",
		viewer: "folder",
		storage: ["workspace_items"],
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
		iconClassName: "text-sky-600 dark:text-sky-400",
		surfaceClassName: "bg-sky-500/10 dark:bg-sky-500/15",
		viewer: "document",
		editor: "tiptap-document",
		storage: ["workspace_items", "content_snapshots"],
		contentFormats: ["document_json", "markdown", "plain_text"],
		assetFamilies: [],
		capabilities: ["view", "edit_rich_text", "index", "ai_read", "ai_edit"],
		realtime: "item-room-when-open",
	},
	file: {
		type: "file",
		family: "file",
		label: "File",
		menuLabel: "Upload file",
		menuDescription: "Soon",
		menuGroup: "primary",
		creatable: false,
		icon: Paperclip,
		iconClassName: "text-rose-600 dark:text-rose-400",
		surfaceClassName: "bg-rose-500/10 dark:bg-rose-500/15",
		viewer: "file-router",
		storage: ["workspace_items", "item_assets", "content_snapshots"],
		contentFormats: ["plain_text", "markdown", "transcript_json"],
		assetFamilies: ["pdf", "image", "audio", "text", "code"],
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
		iconClassName: "text-violet-600 dark:text-violet-400",
		surfaceClassName: "bg-violet-500/10 dark:bg-violet-500/15",
		viewer: "flashcard-deck",
		editor: "flashcard-editor",
		storage: ["workspace_items", "content_snapshots"],
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
		iconClassName: "text-emerald-600 dark:text-emerald-400",
		surfaceClassName: "bg-emerald-500/10 dark:bg-emerald-500/15",
		viewer: "quiz",
		editor: "quiz-editor",
		storage: ["workspace_items", "content_snapshots"],
		contentFormats: ["quiz_json"],
		assetFamilies: [],
		capabilities: ["view", "edit_structured", "index", "ai_read", "ai_edit"],
		realtime: "workspace-events",
	},
} satisfies Record<WorkspaceItemType, WorkspaceItemRegistryEntry>;

export function getWorkspaceObjectRegistryEntry(type: WorkspaceItemType) {
	return workspaceObjectRegistry[type];
}

export const workspaceObjectRegistryEntries: WorkspaceItemRegistryEntry[] =
	Object.values(workspaceObjectRegistry);

export const creatableWorkspaceObjectEntries =
	workspaceObjectRegistryEntries.filter((entry) => entry.creatable);
