import {
	FileText,
	Folder,
	HelpCircle,
	Layers3,
	type LucideIcon,
	Mic,
	Paperclip,
} from "lucide-react";

import type {
	WorkspaceItem,
	WorkspaceItemType,
} from "#/features/workspaces/model/types";

interface WorkspaceItemTypeDisplay {
	label: string;
	menuLabel: string;
	menuDescription?: string;
	menuGroup: "primary" | "learn";
	icon: LucideIcon;
	iconClassName: string;
	surfaceClassName: string;
}

const workspaceItemTypeDisplay: Record<
	WorkspaceItemType,
	WorkspaceItemTypeDisplay
> = {
	folder: {
		label: "Folder",
		menuLabel: "Folder",
		menuGroup: "primary",
		icon: Folder,
		iconClassName: "text-amber-600 dark:text-amber-400",
		surfaceClassName: "bg-amber-500/10 dark:bg-amber-500/15",
	},
	document: {
		label: "Document",
		menuLabel: "Document",
		menuGroup: "primary",
		icon: FileText,
		iconClassName: "text-sky-600 dark:text-sky-400",
		surfaceClassName: "bg-sky-500/10 dark:bg-sky-500/15",
	},
	audio: {
		label: "Audio",
		menuLabel: "Audio",
		menuGroup: "primary",
		icon: Mic,
		iconClassName: "text-orange-600 dark:text-orange-400",
		surfaceClassName: "bg-orange-500/10 dark:bg-orange-500/15",
	},
	flashcard: {
		label: "Flashcard deck",
		menuLabel: "Flashcards",
		menuGroup: "learn",
		icon: Layers3,
		iconClassName: "text-violet-600 dark:text-violet-400",
		surfaceClassName: "bg-violet-500/10 dark:bg-violet-500/15",
	},
	quiz: {
		label: "Quiz",
		menuLabel: "Quiz",
		menuGroup: "learn",
		icon: HelpCircle,
		iconClassName: "text-emerald-600 dark:text-emerald-400",
		surfaceClassName: "bg-emerald-500/10 dark:bg-emerald-500/15",
	},
	pdf: {
		label: "PDF upload",
		menuLabel: "Upload",
		menuGroup: "primary",
		icon: Paperclip,
		iconClassName: "text-rose-600 dark:text-rose-400",
		surfaceClassName: "bg-rose-500/10 dark:bg-rose-500/15",
	},
};

export function getWorkspaceItemTypeDisplay(type: WorkspaceItemType) {
	return workspaceItemTypeDisplay[type];
}

export function getWorkspaceItemDisplay(item: WorkspaceItem) {
	const typeDisplay = getWorkspaceItemTypeDisplay(item.type);

	return {
		...typeDisplay,
		Icon: item.icon,
	};
}

export const workspaceItemCreateActions = Object.entries(
	workspaceItemTypeDisplay,
).map(([type, display]) => ({
	type: type as WorkspaceItemType,
	label: display.menuLabel,
	description: display.menuDescription,
	group: display.menuGroup,
	Icon: display.icon,
	iconClassName: display.iconClassName,
}));

const workspaceItemPrimaryCreateActionOrder: WorkspaceItemType[] = [
	"document",
	"folder",
	"pdf",
	"audio",
];

export const workspaceItemPrimaryCreateActions =
	workspaceItemPrimaryCreateActionOrder.map((type) => {
		const action = workspaceItemCreateActions.find(
			(item) => item.type === type,
		);

		if (!action) {
			throw new Error(`Missing workspace create action for type: ${type}`);
		}

		return action;
	});

export const workspaceItemLearnCreateActions =
	workspaceItemCreateActions.filter((action) => action.group === "learn");
