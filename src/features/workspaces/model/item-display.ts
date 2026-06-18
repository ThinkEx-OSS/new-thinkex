import { type LucideIcon, Mic, Upload } from "lucide-react";
import {
	type WorkspaceItemColor,
	workspaceItemColorSchema,
} from "#/features/workspaces/contracts";
import {
	creatableWorkspaceObjectEntries,
	getWorkspaceObjectRegistryEntry,
} from "#/features/workspaces/model/object-registry";
import type {
	WorkspaceItem,
	WorkspaceItemType,
} from "#/features/workspaces/model/types";
import {
	workspaceColorOptions,
	workspaceColors,
} from "#/features/workspaces/model/workspace-colors";
import {
	resolveWorkspaceFileTypeFromItem,
	workspaceFileUploadTypeLabel,
} from "#/features/workspaces/model/workspace-file";

export const workspaceItemColorOptions = workspaceColorOptions;

const workspaceItemTypeDefaultColor = {
	document: "sky",
	file: "rose",
	flashcard: "violet",
	folder: "amber",
	quiz: "emerald",
} as const satisfies Record<WorkspaceItemType, WorkspaceItemColor>;

export function getWorkspaceItemDisplay(item: WorkspaceItem) {
	const typeDisplay = getWorkspaceObjectRegistryEntry(item.type);
	const palette = getWorkspaceItemPalette(item);
	const fileDescriptor =
		item.type === "file" ? resolveWorkspaceFileTypeFromItem(item) : null;

	return {
		...typeDisplay,
		label: fileDescriptor?.label ?? typeDisplay.label,
		Icon: fileDescriptor?.icon ?? typeDisplay.icon,
		iconClassName: palette.iconClassName,
		surfaceClassName: palette.surfaceClassName,
	};
}

function getWorkspaceItemPalette(item: WorkspaceItem) {
	const customColor = getWorkspaceItemColorValue(item.color);

	if (customColor) {
		return workspaceColors[customColor];
	}

	return workspaceColors[workspaceItemTypeDefaultColor[item.type]];
}

export function getWorkspaceItemColorValue(
	color: string | null,
): WorkspaceItemColor | null {
	const parsed = workspaceItemColorSchema.safeParse(color);

	return parsed.success ? parsed.data : null;
}

export const workspaceItemCreateActions = creatableWorkspaceObjectEntries.map(
	(display) => ({
		type: display.type,
		label: display.menuLabel,
		description: display.menuDescription,
		group: display.menuGroup,
		Icon: display.icon,
		iconClassName:
			workspaceColors[workspaceItemTypeDefaultColor[display.type]]
				.iconClassName,
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
			description: workspaceFileUploadTypeLabel,
			Icon: Upload,
			iconClassName: workspaceColors.rose.iconClassName,
			disabled: false,
		},
		{
			id: "record-audio",
			label: "Record",
			description: "Soon",
			Icon: Mic,
			iconClassName: workspaceColors.orange.iconClassName,
			disabled: true,
		},
	];
