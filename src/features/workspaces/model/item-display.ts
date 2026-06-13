import { type LucideIcon, Mic, Upload } from "lucide-react";

import {
	creatableWorkspaceObjectEntries,
	getWorkspaceObjectRegistryEntry,
} from "#/features/workspaces/model/object-registry";
import type {
	WorkspaceItem,
	WorkspaceItemType,
} from "#/features/workspaces/model/types";

export function getWorkspaceItemTypeDisplay(type: WorkspaceItemType) {
	return getWorkspaceObjectRegistryEntry(type);
}

export function getWorkspaceItemDisplay(item: WorkspaceItem) {
	const typeDisplay = getWorkspaceItemTypeDisplay(item.type);

	return {
		...typeDisplay,
		Icon: typeDisplay.icon,
	};
}

export const workspaceItemCreateActions = creatableWorkspaceObjectEntries.map(
	(display) => ({
		type: display.type,
		label: display.menuLabel,
		description: display.menuDescription,
		group: display.menuGroup,
		Icon: display.icon,
		iconClassName: display.iconClassName,
	}),
);

const workspaceItemPrimaryCreateActionOrder: WorkspaceItemType[] = [
	"document",
	"folder",
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

export interface WorkspaceItemAcquisitionAction {
	id: "upload-file" | "record-audio";
	label: string;
	description: string;
	Icon: LucideIcon;
	iconClassName: string;
	disabled: boolean;
}

export const workspaceItemAcquisitionActions: WorkspaceItemAcquisitionAction[] =
	[
		{
			id: "upload-file",
			label: "Upload",
			description: "PDF",
			Icon: Upload,
			iconClassName: "text-rose-600 dark:text-rose-400",
			disabled: false,
		},
		{
			id: "record-audio",
			label: "Record audio",
			description: "Soon",
			Icon: Mic,
			iconClassName: "text-orange-600 dark:text-orange-400",
			disabled: true,
		},
	];
