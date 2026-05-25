import { Feedback } from "@dnd-kit/dom";
import { useDragOperation, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
	EllipsisVertical,
	FolderInput,
	FolderOpen,
	Palette,
	Pencil,
	Trash2,
} from "lucide-react";
import { type MouseEvent, useCallback, useMemo, useState } from "react";

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
import {
	getWorkspaceFolderDropTargetId,
	getWorkspaceItemSortableGroup,
	WORKSPACE_FOLDER_DRAG_TYPE,
	WORKSPACE_ITEM_DRAG_TYPE,
} from "#/features/workspaces/model/drag";
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

const WORKSPACE_COLLISION_PRIORITY_HIGH = 3;
const WORKSPACE_COLLISION_PRIORITY_HIGHEST = 4;
const WORKSPACE_COLLISION_TYPE_POINTER_INTERSECTION = 2;

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
							{folders.map((item, index) => (
								<WorkspaceItemCard
									key={item.id}
									item={item}
									index={index}
									items={items}
									onOpenItem={onOpenItem}
									onRenameItem={setRenamingItem}
									onDeleteItem={openDeleteAlert}
								/>
							))}
						</section>
					) : null}
					{nonFolderItems.length > 0 ? (
						<section className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
							{nonFolderItems.map((item, index) => (
								<WorkspaceItemCard
									key={item.id}
									item={item}
									index={index}
									items={items}
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
	index,
	items,
	onOpenItem,
	onRenameItem,
	onDeleteItem,
}: {
	item: WorkspaceItem;
	index: number;
	items: WorkspaceItem[];
	onOpenItem: (item: WorkspaceItem) => void;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
}) {
	const isFolder = item.type === "folder";
	const row = isFolder ? "folder" : "item";
	const dragOperation = useDragOperation();
	const folderDropCollisionDetector = useMemo(
		() =>
			({
				dragOperation,
				droppable,
			}: {
				dragOperation: {
					source?: { id?: unknown } | null;
					position: { current: { x: number; y: number } | null };
				};
				droppable: {
					id: string | number;
					shape?: {
						containsPoint: (point: { x: number; y: number }) => boolean;
						center: { x: number; y: number };
					} | null;
				};
			}) => {
				if (dragOperation.source?.id === item.id) {
					return null;
				}

				const pointer = dragOperation.position.current;

				if (!pointer || !droppable.shape) {
					return null;
				}

				if (!droppable.shape.containsPoint(pointer)) {
					return null;
				}

				const cx = droppable.shape.center.x - pointer.x;
				const cy = droppable.shape.center.y - pointer.y;

				return {
					id: droppable.id,
					value: 1 / Math.sqrt(cx * cx + cy * cy),
					type: WORKSPACE_COLLISION_TYPE_POINTER_INTERSECTION,
					priority: WORKSPACE_COLLISION_PRIORITY_HIGH,
				};
			},
		[item.id],
	);
	const {
		isDragging,
		isDropTarget,
		ref: sortableRef,
	} = useSortable({
		id: item.id,
		index,
		type: isFolder ? WORKSPACE_FOLDER_DRAG_TYPE : WORKSPACE_ITEM_DRAG_TYPE,
		accept: isFolder
			? [WORKSPACE_FOLDER_DRAG_TYPE, WORKSPACE_ITEM_DRAG_TYPE]
			: WORKSPACE_ITEM_DRAG_TYPE,
		group: getWorkspaceItemSortableGroup({
			workspaceId: item.workspaceId,
			parentId: item.parentId,
			row,
		}),
		transition: {
			duration: 180,
			easing: "cubic-bezier(0.2, 0, 0, 1)",
			idle: false,
		},
		plugins: (defaults) => [
			...defaults,
			Feedback.configure({ feedback: "clone", dropAnimation: null }),
		],
		data: {
			itemId: item.id,
			parentId: item.parentId,
			row,
		},
	});
	const { isDropTarget: isFolderDropTarget, ref: folderDropTargetRef } =
		useDroppable({
			id: getWorkspaceFolderDropTargetId(item.id),
			type: WORKSPACE_FOLDER_DRAG_TYPE,
			accept: [WORKSPACE_FOLDER_DRAG_TYPE, WORKSPACE_ITEM_DRAG_TYPE],
			disabled: !isFolder,
			collisionPriority: WORKSPACE_COLLISION_PRIORITY_HIGHEST,
			collisionDetector: folderDropCollisionDetector,
			data: {
				kind: "workspace-folder-drop-target",
				folderId: item.id,
				parentId: item.parentId,
			},
		});
	const setCardRef = useCallback(
		(element: HTMLDivElement | null) => {
			sortableRef(element);
			folderDropTargetRef(isFolder ? element : null);
		},
		[folderDropTargetRef, isFolder, sortableRef],
	);
	const showFolderDropAffordance =
		isFolder &&
		isFolderDropTarget &&
		dragOperation.source?.id !== item.id &&
		(dragOperation.source?.type === WORKSPACE_ITEM_DRAG_TYPE ||
			dragOperation.source?.type === WORKSPACE_FOLDER_DRAG_TYPE);
	const isFolderSortingTarget =
		isFolder &&
		isDropTarget &&
		!isFolderDropTarget &&
		dragOperation.source?.type === WORKSPACE_FOLDER_DRAG_TYPE;
	const meta = isFolder ? getWorkspaceItemMeta(item, items) : null;
	const {
		Icon: ItemIcon,
		iconClassName,
		surfaceClassName,
	} = getWorkspaceItemDisplay(item);
	const handleOpen = useCallback(() => {
		onOpenItem(item);
	}, [item, onOpenItem]);
	const handleRenameClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			onRenameItem(item);
		},
		[item, onRenameItem],
	);

	return (
		<Card
			ref={setCardRef}
			className={cn(
				"workspace-item-card group/item relative flex h-full min-h-44 cursor-pointer flex-col gap-0 overflow-hidden py-0 transition-all hover:bg-accent hover:shadow-md active:cursor-grabbing dark:hover:bg-accent/60",
				isDragging && "opacity-70 shadow-lg",
				isDropTarget &&
					!showFolderDropAffordance &&
					!isFolderSortingTarget &&
					"bg-muted/60",
				showFolderDropAffordance &&
					"ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
			)}
		>
			<button
				type="button"
				data-workspace-drag-open
				className={cn(
					"flex min-h-20 flex-1 cursor-pointer items-center justify-center bg-muted outline-none active:cursor-grabbing",
					"focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					surfaceClassName,
				)}
				onClick={handleOpen}
			>
				<ItemIcon
					className={cn("size-10", iconClassName)}
					strokeWidth={1.75}
					aria-hidden="true"
				/>
			</button>
			{showFolderDropAffordance ? (
				<div
					className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/35 backdrop-blur-[1px]"
					aria-hidden="true"
				>
					<div className="flex items-center gap-2 rounded-md border bg-popover px-3 py-2 text-xs font-medium text-popover-foreground shadow-sm">
						<FolderInput className="size-4 text-primary" />
						<span>Move here</span>
					</div>
				</div>
			) : null}
			<CardHeader
				className="shrink-0 gap-2 px-4 py-3"
				onClick={handleOpen}
			>
				<CardTitle className="min-w-0">
					<button
						type="button"
						className="block max-w-full cursor-text truncate rounded-sm text-left underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
						aria-label={`Rename ${item.name}`}
						onClick={handleRenameClick}
					>
						{item.name}
					</button>
				</CardTitle>
				{meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
			</CardHeader>
			<div
				className={cn(
					"pointer-events-none absolute top-2 right-2 z-10 opacity-0 transition-opacity",
					"group-hover/item:pointer-events-auto group-hover/item:opacity-100",
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
