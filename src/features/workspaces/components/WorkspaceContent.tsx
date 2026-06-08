import { FolderOpen } from "lucide-react";
import { useState } from "react";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuTrigger,
} from "#/components/ui/context-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { ScrollArea } from "#/components/ui/scroll-area";
import {
	useWorkspaceMarqueeSelection,
	type WorkspaceMarqueeRect,
} from "#/features/workspaces/components/useWorkspaceMarqueeSelection";
import { useWorkspaceSelection } from "#/features/workspaces/components/useWorkspaceSelection";
import { WorkspaceCreateContextMenuContent } from "#/features/workspaces/components/WorkspaceCreateMenu";
import {
	DeleteWorkspaceItemAlert,
	RenameWorkspaceItemDialog,
} from "#/features/workspaces/components/WorkspaceItemActionDialogs";
import { WorkspaceItemActionsContextMenuContent } from "#/features/workspaces/components/WorkspaceItemActionsMenu";
import WorkspaceItemCard from "#/features/workspaces/components/WorkspaceItemCard";
import WorkspaceSelectionActionBar from "#/features/workspaces/components/WorkspaceSelectionActionBar";
import type { WorkspaceItemType } from "#/features/workspaces/contracts";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import {
	getWorkspaceChildren,
	splitWorkspaceChildren,
} from "#/features/workspaces/model/tree";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import {
	getWorkspaceBrowseParentId,
	isWorkspaceItemView,
} from "#/features/workspaces/model/view";
import { cn } from "#/lib/utils";

interface WorkspaceContentProps {
	items: WorkspaceItem[];
	activeItem?: WorkspaceItem;
	workspaceId: string;
	onCreateItem: (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => void;
	onOpenItem: (item: WorkspaceItem, options?: { background?: boolean }) => void;
}

const noopWorkspaceSelectionAction = () => {};

export default function WorkspaceContent({
	items,
	activeItem,
	workspaceId,
	onCreateItem,
	onOpenItem,
}: WorkspaceContentProps) {
	const [renamingItem, setRenamingItem] = useState<WorkspaceItem | null>(null);
	const [deletingItem, setDeletingItem] = useState<WorkspaceItem | null>(null);
	const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
	const parentId = getWorkspaceBrowseParentId(activeItem);
	const children = isWorkspaceItemView(activeItem)
		? []
		: getWorkspaceChildren(items, parentId);
	const { folders, items: nonFolderItems } = splitWorkspaceChildren(children);
	const {
		clearSelection,
		selectedItemIds,
		selectedItems,
		setItemSelected,
		setSelectedItemIds,
	} = useWorkspaceSelection({
		items,
		workspaceId,
	});
	const {
		marqueeRect,
		registerItemElement,
		surfaceProps: marqueeSurfaceProps,
	} = useWorkspaceMarqueeSelection({
		selectedItemIds,
		setSelectedItemIds,
	});
	const openDeleteAlert = (item: WorkspaceItem) => {
		setDeletingItem(item);
		setDeleteAlertOpen(true);
	};

	if (isWorkspaceItemView(activeItem)) {
		return (
			<>
				<WorkspaceItemView
					item={activeItem}
					onRenameItem={setRenamingItem}
					onDeleteItem={openDeleteAlert}
				/>
				<WorkspaceContentActionDialogs
					renamingItem={renamingItem}
					deletingItem={deletingItem}
					deleteAlertOpen={deleteAlertOpen}
					items={items}
					onRenamingItemChange={setRenamingItem}
					onDeleteAlertOpenChange={setDeleteAlertOpen}
					onDeletingItemClear={() => setDeletingItem(null)}
				/>
			</>
		);
	}

	return (
		<>
			<div className="relative h-[calc(100vh-5.75rem)]">
				<ScrollArea className="h-full">
					<ContextMenu>
						<ContextMenuTrigger
							render={
								<div
									className="space-y-5 px-4 py-3 outline-none"
									data-prompt-type-to-focus-surface
									tabIndex={-1}
									{...marqueeSurfaceProps}
								/>
							}
						>
							{folders.length > 0 ? (
								<WorkspaceItemGrid
									items={folders}
									allItems={items}
									selectedItemIds={selectedItemIds}
									onOpenItem={onOpenItem}
									onRenameItem={setRenamingItem}
									onDeleteItem={openDeleteAlert}
									onSelectionChange={setItemSelected}
									onItemElementChange={registerItemElement}
								/>
							) : null}
							{nonFolderItems.length > 0 ? (
								<WorkspaceItemGrid
									items={nonFolderItems}
									allItems={items}
									selectedItemIds={selectedItemIds}
									onOpenItem={onOpenItem}
									onRenameItem={setRenamingItem}
									onDeleteItem={openDeleteAlert}
									onSelectionChange={setItemSelected}
									onItemElementChange={registerItemElement}
								/>
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
						</ContextMenuTrigger>
						<ContextMenuContent className="w-56">
							<WorkspaceCreateContextMenuContent
								parentId={parentId}
								onCreateItem={onCreateItem}
							/>
						</ContextMenuContent>
					</ContextMenu>
				</ScrollArea>
				<WorkspaceSelectionActionBar
					selectedCount={selectedItems.length}
					onAskAi={noopWorkspaceSelectionAction}
					onMove={noopWorkspaceSelectionAction}
					onDelete={noopWorkspaceSelectionAction}
					onClear={clearSelection}
				/>
				<WorkspaceMarqueeOverlay rect={marqueeRect} />
			</div>
			<WorkspaceContentActionDialogs
				renamingItem={renamingItem}
				deletingItem={deletingItem}
				deleteAlertOpen={deleteAlertOpen}
				items={items}
				onRenamingItemChange={setRenamingItem}
				onDeleteAlertOpenChange={setDeleteAlertOpen}
				onDeletingItemClear={() => setDeletingItem(null)}
			/>
		</>
	);
}

function WorkspaceItemGrid({
	items,
	allItems,
	selectedItemIds,
	onOpenItem,
	onRenameItem,
	onDeleteItem,
	onSelectionChange,
	onItemElementChange,
}: {
	items: WorkspaceItem[];
	allItems: WorkspaceItem[];
	selectedItemIds: ReadonlySet<string>;
	onOpenItem: (item: WorkspaceItem, options?: { background?: boolean }) => void;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
	onSelectionChange: (item: WorkspaceItem, selected: boolean) => void;
	onItemElementChange: (itemId: string, element: HTMLElement | null) => void;
}) {
	return (
		<section className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
			{items.map((item, index) => (
				<WorkspaceItemCard
					key={item.id}
					item={item}
					index={index}
					items={allItems}
					isSelected={selectedItemIds.has(item.id)}
					onOpenItem={onOpenItem}
					onRenameItem={onRenameItem}
					onDeleteItem={onDeleteItem}
					onSelectionChange={onSelectionChange}
					onElementChange={onItemElementChange}
				/>
			))}
		</section>
	);
}

function WorkspaceMarqueeOverlay({
	rect,
}: {
	rect: WorkspaceMarqueeRect | null;
}) {
	if (!rect) {
		return null;
	}

	return (
		<div
			className="pointer-events-none fixed z-20 rounded-sm border border-primary/50 bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.35)_inset]"
			style={{
				height: rect.height,
				left: rect.x,
				top: rect.y,
				width: rect.width,
			}}
		/>
	);
}

function WorkspaceContentActionDialogs({
	renamingItem,
	deletingItem,
	deleteAlertOpen,
	items,
	onRenamingItemChange,
	onDeleteAlertOpenChange,
	onDeletingItemClear,
}: {
	renamingItem: WorkspaceItem | null;
	deletingItem: WorkspaceItem | null;
	deleteAlertOpen: boolean;
	items: WorkspaceItem[];
	onRenamingItemChange: (item: WorkspaceItem | null) => void;
	onDeleteAlertOpenChange: (open: boolean) => void;
	onDeletingItemClear: () => void;
}) {
	return (
		<>
			<RenameWorkspaceItemDialog
				item={renamingItem}
				onOpenChange={(open) => {
					if (!open) {
						onRenamingItemChange(null);
					}
				}}
			/>
			<DeleteWorkspaceItemAlert
				open={deleteAlertOpen}
				item={deletingItem}
				items={items}
				onOpenChange={onDeleteAlertOpenChange}
				onClosed={onDeletingItemClear}
			/>
		</>
	);
}

function WorkspaceItemView({
	item,
	onRenameItem,
	onDeleteItem,
}: {
	item: WorkspaceItem;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
}) {
	const {
		Icon: ItemIcon,
		iconClassName,
		surfaceClassName,
	} = getWorkspaceItemDisplay(item);

	return (
		<div className="h-[calc(100vh-5.75rem)] p-4">
			<ContextMenu>
				<ContextMenuTrigger
					render={
						<section
							className={cn(
								"flex h-full min-h-64 items-center justify-center rounded-md border border-dashed bg-muted/20",
								surfaceClassName,
							)}
						/>
					}
				>
					<ItemIcon
						className={cn("size-12", iconClassName)}
						strokeWidth={1.75}
						aria-hidden="true"
					/>
				</ContextMenuTrigger>
				<WorkspaceItemActionsContextMenuContent
					item={item}
					onRenameItem={onRenameItem}
					onDeleteItem={onDeleteItem}
				/>
			</ContextMenu>
		</div>
	);
}
