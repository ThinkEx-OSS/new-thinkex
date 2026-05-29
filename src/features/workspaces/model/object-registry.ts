import {
	BookOpenCheck,
	Brain,
	Copy,
	Download,
	FileArchive,
	FileText,
	Folder,
	History,
	Layers3,
	ListChecks,
	type LucideIcon,
	Paperclip,
	PencilLine,
	Play,
	Settings2,
	Share2,
	Shuffle,
	Sparkles,
	Upload,
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

export interface WorkspaceItemContextAction {
	id: string;
	label: string;
	icon: LucideIcon;
}

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
	contextActions: readonly WorkspaceItemContextAction[];
	realtime: WorkspaceItemRealtimeModel;
}

const folderContextActions = [
	{ id: "sort", label: "Sort contents", icon: Shuffle },
	{ id: "upload", label: "Upload", icon: Upload },
	{ id: "share-folder", label: "Share folder", icon: Share2 },
	{ id: "folder-settings", label: "Folder settings", icon: Settings2 },
] satisfies WorkspaceItemContextAction[];

const documentContextActions = [
	{ id: "export", label: "Export", icon: Download },
	{ id: "copy-link", label: "Copy link", icon: Copy },
	{ id: "export-markdown", label: "Export Markdown", icon: FileArchive },
	{ id: "summarize", label: "Summarize", icon: Sparkles },
	{ id: "ask-document", label: "Ask document", icon: Brain },
	{ id: "edit", label: "Edit", icon: PencilLine },
	{ id: "version-history", label: "Version history", icon: History },
] satisfies WorkspaceItemContextAction[];

const fileContextActions = [
	{ id: "download", label: "Download", icon: Download },
	{ id: "extract-text", label: "Extract text", icon: FileText },
	{ id: "convert", label: "Convert", icon: FileArchive },
	{ id: "summarize", label: "Summarize", icon: Sparkles },
	{ id: "ask-file", label: "Ask file", icon: Brain },
] satisfies WorkspaceItemContextAction[];

const flashcardContextActions = [
	{ id: "start-review", label: "Start review", icon: Play },
	{ id: "add-cards", label: "Add cards", icon: Layers3 },
	{ id: "shuffle", label: "Shuffle", icon: Shuffle },
	{ id: "export-deck", label: "Export deck", icon: Download },
] satisfies WorkspaceItemContextAction[];

const quizContextActions = [
	{ id: "preview", label: "Preview", icon: BookOpenCheck },
	{ id: "grade", label: "Grade", icon: ListChecks },
	{ id: "generate-questions", label: "Generate questions", icon: Sparkles },
	{ id: "export-results", label: "Export results", icon: Download },
] satisfies WorkspaceItemContextAction[];

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
		storage: ["workspace_kernel.items"],
		contentFormats: [],
		assetFamilies: [],
		capabilities: ["view"],
		contextActions: folderContextActions,
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
		storage: ["workspace_kernel.items", "workspace_kernel.snapshots"],
		contentFormats: ["document_json", "markdown", "plain_text"],
		assetFamilies: [],
		capabilities: ["view", "edit_rich_text", "index", "ai_read", "ai_edit"],
		contextActions: documentContextActions,
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
		storage: [
			"workspace_kernel.items",
			"workspace_kernel.assets",
			"workspace_kernel.snapshots",
		],
		contentFormats: ["plain_text", "markdown", "transcript_json"],
		assetFamilies: ["pdf", "image", "audio", "text", "code"],
		capabilities: ["view", "index", "ai_read"],
		contextActions: fileContextActions,
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
		storage: ["workspace_kernel.items", "workspace_kernel.snapshots"],
		contentFormats: ["flashcard_json"],
		assetFamilies: [],
		capabilities: ["view", "edit_structured", "index", "ai_read", "ai_edit"],
		contextActions: flashcardContextActions,
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
		storage: ["workspace_kernel.items", "workspace_kernel.snapshots"],
		contentFormats: ["quiz_json"],
		assetFamilies: [],
		capabilities: ["view", "edit_structured", "index", "ai_read", "ai_edit"],
		contextActions: quizContextActions,
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
