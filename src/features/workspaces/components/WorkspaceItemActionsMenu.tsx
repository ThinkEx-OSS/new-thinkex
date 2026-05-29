import {
	EllipsisVertical,
	FolderInput,
	Palette,
	Pencil,
	Trash2,
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "#/components/ui/button";
import { ContextMenuContent } from "#/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	workspaceContextMenuRenderer,
	workspaceDropdownMenuRenderer,
} from "#/features/workspaces/components/WorkspaceMenuRenderers";
import type { WorkspaceMenuRenderer } from "#/features/workspaces/components/workspace-menu-actions";
import { renderWorkspaceMenuActions } from "#/features/workspaces/components/workspace-menu-actions";
import type { WorkspaceItem } from "#/features/workspaces/model/types";

interface WorkspaceItemActionsMenuProps {
	item: WorkspaceItem;
	trigger?: ReactElement;
	triggerChildren?: ReactNode;
	align?: "start" | "center" | "end";
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
}

export default function WorkspaceItemActionsMenu({
	item,
	trigger,
	triggerChildren,
	align = "end",
	onRenameItem,
	onDeleteItem,
}: WorkspaceItemActionsMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					trigger ?? (
						<Button
							variant="ghost"
							size="icon-sm"
							className="text-muted-foreground hover:text-foreground"
							aria-label={`Open actions for ${item.name}`}
						/>
					)
				}
			>
				{triggerChildren ?? <EllipsisVertical className="size-4" />}
			</DropdownMenuTrigger>
			<DropdownMenuContent align={align} className="w-52">
				<WorkspaceItemActionsMenuContent
					item={item}
					onRenameItem={onRenameItem}
					onDeleteItem={onDeleteItem}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function WorkspaceItemActionsMenuContent({
	item,
	onRenameItem,
	onDeleteItem,
	renderer = workspaceDropdownMenuRenderer,
}: {
	item: WorkspaceItem;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
	renderer?: WorkspaceMenuRenderer;
}) {
	return renderWorkspaceMenuActions(
		getWorkspaceItemMenuActions({ item, onRenameItem, onDeleteItem }),
		renderer,
	);
}

export function WorkspaceItemActionsContextMenuContent({
	item,
	onRenameItem,
	onDeleteItem,
}: {
	item: WorkspaceItem;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
}) {
	return (
		<ContextMenuContent className="w-52">
			<WorkspaceItemActionsMenuContent
				item={item}
				onRenameItem={onRenameItem}
				onDeleteItem={onDeleteItem}
				renderer={workspaceContextMenuRenderer}
			/>
		</ContextMenuContent>
	);
}

function getWorkspaceItemMenuActions({
	item,
	onRenameItem,
	onDeleteItem,
}: {
	item: WorkspaceItem;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
}) {
	return [
		{
			kind: "item" as const,
			id: "rename",
			label: "Rename",
			leading: <Pencil className="size-4" />,
			onSelect: () => onRenameItem(item),
		},
		{
			kind: "submenu" as const,
			id: "change-color",
			label: "Change color",
			leading: <Palette className="size-4" />,
			disabled: true,
			actions: workspaceItemColorOptions.map((option) => ({
				kind: "item" as const,
				id: option.label,
				label: option.label,
				disabled: true,
				leading: (
					<span
						className={`size-3 rounded-full ${option.className}`}
						aria-hidden="true"
					/>
				),
			})),
		},
		{
			kind: "item" as const,
			id: "move-to-folder",
			label: "Move to folder",
			leading: <FolderInput className="size-4" />,
			disabled: true,
		},
		{ kind: "separator" as const, id: "danger-separator" },
		{
			kind: "item" as const,
			id: "delete",
			label: "Delete",
			leading: <Trash2 className="size-4" />,
			variant: "destructive" as const,
			onSelect: () => onDeleteItem(item),
		},
	];
}

const workspaceItemColorOptions = [
	{ label: "Default", className: "bg-muted ring-1 ring-border" },
	{ label: "Sky", className: "bg-sky-500" },
	{ label: "Emerald", className: "bg-emerald-500" },
	{ label: "Amber", className: "bg-amber-500" },
	{ label: "Rose", className: "bg-rose-500" },
] as const;
