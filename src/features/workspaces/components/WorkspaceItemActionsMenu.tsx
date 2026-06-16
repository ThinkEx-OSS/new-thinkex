import {
	EllipsisVertical,
	FolderInput,
	Palette,
	Pencil,
	Trash2,
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "#/components/ui/button";
import { ColorSwatchPicker } from "#/components/ui/color-swatch-picker";
import {
	ContextMenuContent,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
} from "#/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	workspaceContextMenuRenderer,
	workspaceDropdownMenuRenderer,
} from "#/features/workspaces/components/WorkspaceMenuRenderers";
import type { WorkspaceMenuRenderer } from "#/features/workspaces/components/workspace-menu-actions";
import type { WorkspaceItemColor } from "#/features/workspaces/contracts";
import {
	getWorkspaceItemColorValue,
	workspaceItemColorOptions,
} from "#/features/workspaces/model/item-display";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { useUpdateWorkspaceItemColorMutation } from "#/features/workspaces/use-workspace-kernel-items";

const workspaceItemColorSubmenuTrigger = (
	<>
		<Palette className="size-4" />
		<span>Change color</span>
	</>
);

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
	menuKind = "dropdown",
}: {
	item: WorkspaceItem;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
	renderer?: WorkspaceMenuRenderer;
	menuKind?: "dropdown" | "context";
}) {
	const updateWorkspaceItemColorMutation =
		useUpdateWorkspaceItemColorMutation();

	return (
		<>
			<WorkspaceItemRenameMenuItem
				item={item}
				renderer={renderer}
				onRenameItem={onRenameItem}
			/>
			<WorkspaceItemColorSubmenu
				item={item}
				menuKind={menuKind}
				onUpdateItemColor={(color) =>
					updateWorkspaceItemColorMutation.mutate({
						workspaceId: item.workspaceId,
						itemId: item.id,
						color,
					})
				}
			/>
			<WorkspaceItemMoveToFolderMenuItem renderer={renderer} />
			{renderer.separator("danger-separator")}
			<WorkspaceItemDeleteMenuItem
				item={item}
				renderer={renderer}
				onDeleteItem={onDeleteItem}
			/>
		</>
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
				menuKind="context"
			/>
		</ContextMenuContent>
	);
}

function WorkspaceItemRenameMenuItem({
	item,
	renderer,
	onRenameItem,
}: {
	item: WorkspaceItem;
	renderer: WorkspaceMenuRenderer;
	onRenameItem: (item: WorkspaceItem) => void;
}) {
	return renderer.item({
		id: "rename",
		onClick: () => onRenameItem(item),
		children: (
			<>
				<Pencil className="size-4" />
				<span>Rename</span>
			</>
		),
	});
}

function WorkspaceItemColorSubmenu({
	item,
	menuKind,
	onUpdateItemColor,
}: {
	item: WorkspaceItem;
	menuKind: "dropdown" | "context";
	onUpdateItemColor: (color: WorkspaceItemColor) => void;
}) {
	const selectedColor = getWorkspaceItemColorValue(item.color);
	const content = (
		<ColorSwatchPicker
			aria-label={`Color for ${item.name}`}
			value={selectedColor}
			options={workspaceItemColorOptions}
			onValueChange={onUpdateItemColor}
			showLabels={false}
			className="grid-flow-col grid-rows-4 gap-1.5"
		/>
	);

	if (menuKind === "context") {
		return (
			<ContextMenuSub>
				<ContextMenuSubTrigger>
					{workspaceItemColorSubmenuTrigger}
				</ContextMenuSubTrigger>
				<ContextMenuSubContent className="max-w-[calc(100vw-2rem)] w-fit overflow-x-auto p-2">
					{content}
				</ContextMenuSubContent>
			</ContextMenuSub>
		);
	}

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				{workspaceItemColorSubmenuTrigger}
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="max-w-[calc(100vw-2rem)] w-fit overflow-x-auto p-2">
				{content}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}

function WorkspaceItemMoveToFolderMenuItem({
	renderer,
}: {
	renderer: WorkspaceMenuRenderer;
}) {
	return renderer.item({
		id: "move-to-folder",
		disabled: true,
		children: (
			<>
				<FolderInput className="size-4" />
				<span>Move to folder</span>
			</>
		),
	});
}

function WorkspaceItemDeleteMenuItem({
	item,
	renderer,
	onDeleteItem,
}: {
	item: WorkspaceItem;
	renderer: WorkspaceMenuRenderer;
	onDeleteItem: (item: WorkspaceItem) => void;
}) {
	return renderer.item({
		id: "delete",
		variant: "destructive",
		onClick: () => onDeleteItem(item),
		children: (
			<>
				<Trash2 className="size-4" />
				<span>Delete</span>
			</>
		),
	});
}
