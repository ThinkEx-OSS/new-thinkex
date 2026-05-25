import {
	EllipsisVertical,
	FolderInput,
	Palette,
	Pencil,
	Trash2,
} from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { cn } from "#/lib/utils";

interface WorkspaceItemActionsMenuProps {
	item: WorkspaceItem;
	trigger?: ReactElement;
	align?: "start" | "center" | "end";
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
}

export default function WorkspaceItemActionsMenu({
	item,
	trigger,
	align = "end",
	onRenameItem,
	onDeleteItem,
}: WorkspaceItemActionsMenuProps) {
	const { Icon, iconClassName } = getWorkspaceItemDisplay(item);

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
				<EllipsisVertical className="size-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align={align} className="w-52">
				<div className="flex min-w-0 items-center gap-2 px-2 py-1.5">
					<Icon
						className={cn("size-3.5 shrink-0", iconClassName)}
						aria-hidden="true"
					/>
					<span className="truncate text-xs font-medium text-foreground">
						{item.name}
					</span>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => onRenameItem(item)}>
					<Pencil className="size-4" />
					<span>Rename</span>
				</DropdownMenuItem>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Palette className="size-4" />
						<span>Change color</span>
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="w-40">
						{workspaceItemColorOptions.map((option) => (
							<DropdownMenuItem key={option.label}>
								<span
									className={cn("size-3 rounded-full", option.className)}
									aria-hidden="true"
								/>
								<span>{option.label}</span>
							</DropdownMenuItem>
						))}
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuItem>
					<FolderInput className="size-4" />
					<span>Move to folder</span>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					variant="destructive"
					onClick={() => onDeleteItem(item)}
				>
					<Trash2 className="size-4" />
					<span>Delete</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

const workspaceItemColorOptions = [
	{ label: "Default", className: "bg-muted ring-1 ring-border" },
	{ label: "Sky", className: "bg-sky-500" },
	{ label: "Emerald", className: "bg-emerald-500" },
	{ label: "Amber", className: "bg-amber-500" },
	{ label: "Rose", className: "bg-rose-500" },
] as const;
