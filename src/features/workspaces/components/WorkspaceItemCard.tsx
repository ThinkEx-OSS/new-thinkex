import { Feedback } from "@dnd-kit/dom";
import { useDragOperation } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { FolderInput } from "lucide-react";
import { type MouseEvent, useState } from "react";

import { Button } from "#/components/ui/button";
import { Card, CardHeader, CardTitle } from "#/components/ui/card";
import { Checkbox } from "#/components/ui/checkbox";
import { ContextMenu, ContextMenuTrigger } from "#/components/ui/context-menu";
import { useWorkspaceFolderDropTarget } from "#/features/workspaces/components/useWorkspaceDropTarget";
import WorkspaceItemActionsMenu, {
	WorkspaceItemActionsContextMenuContent,
} from "#/features/workspaces/components/WorkspaceItemActionsMenu";
import {
	createWorkspaceItemDragData,
	getWorkspaceDragSource,
	getWorkspaceItemDragTypeForRow,
	getWorkspaceItemSortableAccept,
	getWorkspaceItemSortableGroup,
} from "#/features/workspaces/model/drag";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import { getWorkspaceItemMeta } from "#/features/workspaces/model/tree";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { cn } from "#/lib/utils";

const WORKSPACE_COLLISION_PRIORITY_HIGH = 3;
const WORKSPACE_COLLISION_PRIORITY_HIGHEST = 4;
const WORKSPACE_COLLISION_TYPE_POINTER_INTERSECTION = 2;
const WORKSPACE_ITEM_PREVIEW_CONTROL_ROW = "2.5rem";
const WORKSPACE_ITEM_PREVIEW_CONTROL_INSET = "px-2";
const WORKSPACE_ITEM_PREVIEW_CONTROL_TARGET =
	"flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

interface WorkspaceItemCardProps {
	item: WorkspaceItem;
	index: number;
	items: WorkspaceItem[];
	onOpenItem: (item: WorkspaceItem, options?: { background?: boolean }) => void;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
}

export default function WorkspaceItemCard({
	item,
	index,
	items,
	onOpenItem,
	onRenameItem,
	onDeleteItem,
}: WorkspaceItemCardProps) {
	const [isSelectionPreviewed, setIsSelectionPreviewed] = useState(false);
	const isFolder = item.type === "folder";
	const row = isFolder ? "folder" : "item";
	const sortableDragType = getWorkspaceItemDragTypeForRow(row);
	const dragOperation = useDragOperation();
	const dragSource = getWorkspaceDragSource(dragOperation.source);
	const folderDropCollisionDetector = ({
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
	};
	const {
		isDragging,
		isDropTarget,
		ref: sortableRef,
	} = useSortable({
		id: item.id,
		index,
		type: sortableDragType,
		accept: getWorkspaceItemSortableAccept(row),
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
		data: createWorkspaceItemDragData({
			itemId: item.id,
			parentId: item.parentId,
			row,
		}),
	});
	const { isDropTarget: isFolderDropTarget, ref: folderDropTargetRef } =
		useWorkspaceFolderDropTarget({
			folderId: item.id,
			parentId: item.parentId,
			disabled: !isFolder,
			collisionPriority: WORKSPACE_COLLISION_PRIORITY_HIGHEST,
			collisionDetector: folderDropCollisionDetector,
		});
	const setCardRef = (element: HTMLDivElement | null) => {
		sortableRef(element);
		folderDropTargetRef(isFolder ? element : null);
	};
	const showFolderDropAffordance =
		isFolder &&
		isFolderDropTarget &&
		dragSource?.kind === "workspace-item" &&
		dragSource.itemId !== item.id;
	const isFolderSortingTarget =
		isFolder &&
		isDropTarget &&
		!isFolderDropTarget &&
		dragSource?.kind === "workspace-item" &&
		dragSource.row === "folder";
	const meta = isFolder ? getWorkspaceItemMeta(item, items) : null;
	const {
		Icon: ItemIcon,
		iconClassName,
		surfaceClassName,
	} = getWorkspaceItemDisplay(item);

	const handleOpen = (event: MouseEvent<HTMLElement>) => {
		if (event.metaKey || event.ctrlKey) {
			onOpenItem(item, { background: true });
			return;
		}

		onOpenItem(item);
	};
	const handleRenameClick = (event: MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		onRenameItem(item);
	};
	const handleSelectionPreviewClick = (
		event: MouseEvent<HTMLButtonElement>,
	) => {
		event.stopPropagation();
		setIsSelectionPreviewed((current) => !current);
	};

	const card = (
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
			onContextMenu={(event) => event.stopPropagation()}
		>
			<div
				className={cn("grid min-h-20 flex-1 bg-muted", surfaceClassName)}
				style={{
					gridTemplateRows: `${WORKSPACE_ITEM_PREVIEW_CONTROL_ROW} 1fr ${WORKSPACE_ITEM_PREVIEW_CONTROL_ROW}`,
				}}
			>
				<div
					className={cn(
						"pointer-events-none flex items-center justify-between gap-2 opacity-0 transition-opacity",
						WORKSPACE_ITEM_PREVIEW_CONTROL_INSET,
						"group-hover/item:pointer-events-auto group-hover/item:opacity-100",
						"has-[button[data-popup-open]]:pointer-events-auto has-[button[data-popup-open]]:opacity-100",
						isSelectionPreviewed && "pointer-events-auto opacity-100",
					)}
				>
					<button
						type="button"
						className={WORKSPACE_ITEM_PREVIEW_CONTROL_TARGET}
						aria-label={`Select ${item.name}`}
						aria-pressed={isSelectionPreviewed}
						onClick={handleSelectionPreviewClick}
					>
						<Checkbox
							aria-hidden="true"
							checked={isSelectionPreviewed}
							className="pointer-events-none"
							tabIndex={-1}
						/>
					</button>
					{isFolder ? (
						<div className="size-8" aria-hidden="true" />
					) : (
						<WorkspaceItemActionsMenu
							item={item}
							trigger={
								<Button
									variant="ghost"
									size="icon-sm"
									className="shrink-0 text-muted-foreground hover:text-foreground"
									aria-label={`Open actions for ${item.name}`}
									onClick={(event) => event.stopPropagation()}
								/>
							}
							onRenameItem={onRenameItem}
							onDeleteItem={onDeleteItem}
						/>
					)}
				</div>
				<button
					type="button"
					data-workspace-drag-open
					className="flex cursor-pointer items-center justify-center bg-transparent outline-none active:cursor-grabbing focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					onClick={handleOpen}
				>
					<ItemIcon
						className={cn("size-10", iconClassName)}
						strokeWidth={1.75}
						aria-hidden="true"
					/>
				</button>
				<div aria-hidden="true" />
			</div>
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
			<CardHeader className="shrink-0 gap-2 px-4 py-3" onClick={handleOpen}>
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
		</Card>
	);

	return (
		<ContextMenu>
			<ContextMenuTrigger render={card} />
			<WorkspaceItemActionsContextMenuContent
				item={item}
				onRenameItem={onRenameItem}
				onDeleteItem={onDeleteItem}
			/>
		</ContextMenu>
	);
}
