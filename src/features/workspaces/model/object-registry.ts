import {
	FilePen,
	Folder,
	Layers3,
	ListChecks,
	type LucideIcon,
	Paperclip,
} from "lucide-react";

import type { WorkspaceItemType } from "#/features/workspaces/contracts";
import { workspaceFileUploadTypeLabel } from "#/features/workspaces/model/workspace-file";

export type WorkspaceItemCreateGroup = "primary" | "learn";

export type WorkspaceItemCardPreview = "fill" | "icon";

export interface WorkspaceItemRegistryEntry {
	type: WorkspaceItemType;
	label: string;
	menuLabel: string;
	menuDescription?: string;
	menuGroup: WorkspaceItemCreateGroup;
	creatable: boolean;
	icon: LucideIcon;
	cardPreview: WorkspaceItemCardPreview;
}

export const workspaceObjectRegistry = {
	folder: {
		type: "folder",
		label: "Folder",
		menuLabel: "Folder",
		menuGroup: "primary",
		creatable: true,
		icon: Folder,
		cardPreview: "icon",
	},
	document: {
		type: "document",
		label: "Document",
		menuLabel: "Document",
		menuGroup: "primary",
		creatable: true,
		icon: FilePen,
		cardPreview: "fill",
	},
	file: {
		type: "file",
		label: "File",
		menuLabel: "Upload file",
		menuDescription: workspaceFileUploadTypeLabel,
		menuGroup: "primary",
		creatable: false,
		icon: Paperclip,
		cardPreview: "fill",
	},
	flashcard: {
		type: "flashcard",
		label: "Flashcard deck",
		menuLabel: "Flashcards",
		menuGroup: "learn",
		creatable: true,
		icon: Layers3,
		cardPreview: "icon",
	},
	quiz: {
		type: "quiz",
		label: "Quiz",
		menuLabel: "Quiz",
		menuGroup: "learn",
		creatable: true,
		icon: ListChecks,
		cardPreview: "icon",
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
