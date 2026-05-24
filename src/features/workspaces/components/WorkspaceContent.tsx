import {
	Copy,
	EllipsisVertical,
	FolderInput,
	FolderOpen,
	Palette,
	Pencil,
	Trash2,
} from "lucide-react";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import { Card, CardHeader, CardTitle } from "#/components/ui/card";
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
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { ScrollArea } from "#/components/ui/scroll-area";
import {
	DeleteWorkspaceItemAlert,
	RenameWorkspaceItemDialog,
} from "#/features/workspaces/components/WorkspaceItemActionDialogs";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import {
	getWorkspaceChildren,
	getWorkspaceItemMeta,
	splitWorkspaceChildren,
} from "#/features/workspaces/model/tree";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { cn } from "#/lib/utils";

interface WorkspaceContentProps {
	items: WorkspaceItem[];
	activeItem?: WorkspaceItem;
	onOpenItem: (item: WorkspaceItem) => void;
}

export default function WorkspaceContent({
	items,
	activeItem,
	onOpenItem,
}: WorkspaceContentProps) {
	const [renamingItem, setRenamingItem] = useState<WorkspaceItem | null>(null);
	const [deletingItem, setDeletingItem] = useState<WorkspaceItem | null>(null);
	const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

	if (activeItem && activeItem.type !== "folder") {
		return <WorkspaceItemView item={activeItem} />;
	}

	const parentId = activeItem?.type === "folder" ? activeItem.id : null;
	const children = getWorkspaceChildren(items, parentId);
	const { folders, items: nonFolderItems } = splitWorkspaceChildren(children);
	const openDeleteAlert = (item: WorkspaceItem) => {
		setDeletingItem(item);
		setDeleteAlertOpen(true);
	};

	return (
		<>
			<ScrollArea className="h-[calc(100vh-5.75rem)]">
				<div className="space-y-5 px-4 py-3">
					{folders.length > 0 ? (
						<section className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
							{folders.map((item) => (
								<WorkspaceItemCard
									key={item.id}
									item={item}
									meta={getWorkspaceItemMeta(item, items)}
									onOpenItem={onOpenItem}
									onRenameItem={setRenamingItem}
									onDeleteItem={openDeleteAlert}
								/>
							))}
						</section>
					) : null}
					{nonFolderItems.length > 0 ? (
						<section className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
							{nonFolderItems.map((item) => (
								<WorkspaceItemCard
									key={item.id}
									item={item}
									meta={getWorkspaceItemMeta(item, items)}
									onOpenItem={onOpenItem}
									onRenameItem={setRenamingItem}
									onDeleteItem={openDeleteAlert}
								/>
							))}
						</section>
					) : null}
					{children.length === 0 ? (
						<Empty className="border border-dashed bg-muted/20">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<FolderOpen />
								</EmptyMedia>
								<EmptyTitle>No items in this folder</EmptyTitle>
								<EmptyDescription>
									Items you add here will appear in this workspace view.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : null}
				</div>
			</ScrollArea>
			<RenameWorkspaceItemDialog
				item={renamingItem}
				onOpenChange={(open) => {
					if (!open) {
						setRenamingItem(null);
					}
				}}
			/>
			<DeleteWorkspaceItemAlert
				open={deleteAlertOpen}
				item={deletingItem}
				items={items}
				onOpenChange={(open) => {
					setDeleteAlertOpen(open);
				}}
				onClosed={() => setDeletingItem(null)}
			/>
		</>
	);
}

function WorkspaceItemCard({
	item,
	meta,
	onOpenItem,
	onRenameItem,
	onDeleteItem,
}: {
	item: WorkspaceItem;
	meta: string;
	onOpenItem: (item: WorkspaceItem) => void;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
}) {
	const {
		Icon: ItemIcon,
		iconClassName,
		surfaceClassName,
	} = getWorkspaceItemDisplay(item);

	return (
		<Card className="group/item relative gap-0 overflow-hidden py-0 transition-all hover:bg-accent hover:shadow-md dark:hover:bg-accent/60">
			<button
				type="button"
				className="flex w-full flex-col text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				onClick={() => onOpenItem(item)}
			>
				<div
					className={cn(
						"flex aspect-[5/2] items-center justify-center bg-muted",
						surfaceClassName,
					)}
				>
					<ItemIcon
						className={cn("size-10", iconClassName)}
						strokeWidth={1.75}
						aria-hidden="true"
					/>
				</div>
				<CardHeader className="gap-2 py-5">
					<CardTitle>{item.name}</CardTitle>
					<p className="text-xs text-muted-foreground">{meta}</p>
				</CardHeader>
			</button>
			<div
				className={cn(
					"pointer-events-none absolute top-2 right-2 z-10 opacity-0 transition-opacity",
					"group-hover/item:pointer-events-auto group-hover/item:opacity-100",
					"group-focus-within/item:pointer-events-auto group-focus-within/item:opacity-100",
					"has-[button[data-popup-open]]:pointer-events-auto has-[button[data-popup-open]]:opacity-100",
				)}
			>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="ghost"
								size="icon-sm"
								className="text-muted-foreground hover:text-foreground"
								aria-label={`Open actions for ${item.name}`}
								onClick={(event) => event.stopPropagation()}
							/>
						}
					>
						<EllipsisVertical className="size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-52">
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
							<Copy className="size-4" />
							<span>Duplicate</span>
						</DropdownMenuItem>
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
			</div>
		</Card>
	);
}

const workspaceItemColorOptions = [
	{ label: "Default", className: "bg-muted ring-1 ring-border" },
	{ label: "Sky", className: "bg-sky-500" },
	{ label: "Emerald", className: "bg-emerald-500" },
	{ label: "Amber", className: "bg-amber-500" },
	{ label: "Rose", className: "bg-rose-500" },
] as const;

function WorkspaceItemView({ item }: { item: WorkspaceItem }) {
	return (
		<div className="px-4 py-3">
			<section className="flex min-h-64 items-center justify-center rounded-md border border-dashed bg-muted/20 text-sm text-muted-foreground">
				{item.name} content placeholder
			</section>
		</div>
	);
}
