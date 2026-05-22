import type { LucideIcon } from "lucide-react";

export type WorkspaceItemType =
	| "folder"
	| "document"
	| "audio"
	| "flashcard"
	| "quiz"
	| "pdf";

export interface WorkspaceItem {
	id: string;
	workspaceId: string;
	type: WorkspaceItemType;
	parentId: string | null;
	name: string;
	meta: string;
	icon: LucideIcon;
	sortOrder: number;
}
