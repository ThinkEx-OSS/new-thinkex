import {
	EllipsisVertical,
	FolderInput,
	Palette,
	Pencil,
	Trash2,
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";

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
import { WorkspaceToolbarIconButton } from "#/features/workspaces/components/WorkspaceToolbar";
import type { WorkspaceMenuRenderer } from "#/features/workspaces/components/workspace-menu-actions";
import type { WorkspaceItemColor } from "#/features/workspaces/contracts";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import {
	getWorkspaceItemColorValue,
	workspaceItemColorOptions,
	workspaceItemSupportsCustomColor,
} from "#/features/workspaces/model/workspace-item-colors";
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
	onMoveItem: (item: WorkspaceItem) => void;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
}

export default function WorkspaceItemActionsMenu({
	item,
	trigger,
	triggerChildren,
	align = "end",
	onMoveItem,
	onRenameItem,
	onDeleteItem,
}: WorkspaceItemActionsMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					trigger ?? (
						<WorkspaceToolbarIconButton
							aria-label={`Open actions for ${item.name}`}
						/>
					)
				}
			>
				{triggerChildren ?? (trigger ? null : <EllipsisVertical />)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align={align} className="w-52">
				<WorkspaceItemActionsMenuContent
					item={item}
					onMoveItem={onMoveItem}
					onRenameItem={onRenameItem}
					onDeleteItem={onDeleteItem}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function WorkspaceItemActionsMenuContent({
	item,
	onMoveItem,
	onRenameItem,
	onDeleteItem,
	renderer = workspaceDropdownMenuRenderer,
	menuKind = "dropdown",
}: {
	item: WorkspaceItem;
	onMoveItem: (item: WorkspaceItem) => void;
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
			{workspaceItemSupportsCustomColor(item.type) ? (
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
			) : null}
			<WorkspaceItemMoveMenuItem
				item={item}
				renderer={renderer}
				onMoveItem={onMoveItem}
			/>
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
	onMoveItem,
	onRenameItem,
	onDeleteItem,
}: {
	item: WorkspaceItem;
	onMoveItem: (item: WorkspaceItem) => void;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
}) {
	return (
		<ContextMenuContent className="w-52">
			<WorkspaceItemActionsMenuContent
				item={item}
				onMoveItem={onMoveItem}
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

function WorkspaceItemMoveMenuItem({
	item,
	renderer,
	onMoveItem,
}: {
	item: WorkspaceItem;
	renderer: WorkspaceMenuRenderer;
	onMoveItem: (item: WorkspaceItem) => void;
}) {
	return renderer.item({
		id: "move",
		onClick: () => onMoveItem(item),
		children: (
			<>
				<FolderInput className="size-4" />
				<span>Move</span>
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
