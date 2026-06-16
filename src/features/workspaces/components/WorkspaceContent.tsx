import { FolderOpen, Upload } from "lucide-react";
import { type DragEvent, lazy, Suspense, useState } from "react";

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
import { Spinner } from "#/components/ui/spinner";
import { DocumentEditorSurface } from "#/features/workspaces/components/document-editor/DocumentEditorSurface";
import { useWorkspaceItemActionDialogState } from "#/features/workspaces/components/useWorkspaceItemActionDialogState";
import {
	useWorkspaceMarqueeSelection,
	type WorkspaceMarqueeRect,
} from "#/features/workspaces/components/useWorkspaceMarqueeSelection";
import { useWorkspaceSelection } from "#/features/workspaces/components/useWorkspaceSelection";
import { WorkspaceCreateContextMenuContent } from "#/features/workspaces/components/WorkspaceCreateMenu";
import { useWorkspaceFileUpload } from "#/features/workspaces/components/WorkspaceFileUploadProvider";
import {
	DeleteWorkspaceItemAlert,
	DeleteWorkspaceItemsAlert,
	RenameWorkspaceItemDialog,
	WorkspaceDeleteSelectedItemsDescription,
} from "#/features/workspaces/components/WorkspaceItemActionDialogs";
import { WorkspaceItemActionsContextMenuContent } from "#/features/workspaces/components/WorkspaceItemActionsMenu";
import WorkspaceItemCard from "#/features/workspaces/components/WorkspaceItemCard";
import WorkspaceSelectionActionBar from "#/features/workspaces/components/WorkspaceSelectionActionBar";
import { isWorkspacePdfItem } from "#/features/workspaces/components/workspace-pdf-item";
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
import { workspaceFileUploadTypeLabel } from "#/features/workspaces/workspace-file-uploads";
import { cn } from "#/lib/utils";

interface WorkspaceContentProps {
	instanceId?: string;
	items: WorkspaceItem[];
	activeItem?: WorkspaceItem;
	workspaceId: string;
	onCreateItem: (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => void;
	onAddItemsToAiContext?: (items: WorkspaceItem[]) => void;
	onOpenItem: (item: WorkspaceItem, options?: { background?: boolean }) => void;
}

const noopWorkspaceSelectionAction = () => {};
const WorkspacePdfViewer = lazy(
	() => import("#/features/workspaces/components/WorkspacePdfViewer"),
);

export default function WorkspaceContent({
	instanceId,
	items,
	activeItem,
	workspaceId,
	onAddItemsToAiContext,
	onCreateItem,
	onOpenItem,
}: WorkspaceContentProps) {
	const {
		clearDeletingItem,
		deleteAlertOpen,
		deletingItem,
		openDeleteAlert,
		renamingItem,
		setDeleteAlertOpen,
		setRenamingItem,
	} = useWorkspaceItemActionDialogState();
	const [deleteSelectedAlertOpen, setDeleteSelectedAlertOpen] = useState(false);
	const [isNativeFileDropTarget, setIsNativeFileDropTarget] = useState(false);
	const { uploadFiles } = useWorkspaceFileUpload();
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
	const handleNativeFileDrag = (event: DragEvent<HTMLElement>) => {
		if (!hasNativeFiles(event.dataTransfer)) {
			return;
		}

		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
		setIsNativeFileDropTarget(true);
	};
	const handleNativeFileDragLeave = (event: DragEvent<HTMLElement>) => {
		if (
			event.relatedTarget instanceof Node &&
			event.currentTarget.contains(event.relatedTarget)
		) {
			return;
		}

		setIsNativeFileDropTarget(false);
	};
	const handleNativeFileDrop = (event: DragEvent<HTMLElement>) => {
		if (!hasNativeFiles(event.dataTransfer)) {
			return;
		}

		event.preventDefault();
		setIsNativeFileDropTarget(false);
		uploadFiles(Array.from(event.dataTransfer.files), parentId);
	};
	const handleAskAi = () => {
		if (selectedItems.length === 0) {
			return;
		}

		onAddItemsToAiContext?.(selectedItems);
		clearSelection();
	};
	const openDeleteSelectedAlert = () => {
		if (selectedItems.length === 0) {
			return;
		}

		setDeleteSelectedAlertOpen(true);
	};

	if (isWorkspaceItemView(activeItem)) {
		return (
			<>
				<WorkspaceItemView
					item={activeItem}
					viewInstanceId={instanceId ?? activeItem.id}
					workspaceId={workspaceId}
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
					onDeletingItemClear={clearDeletingItem}
				/>
			</>
		);
	}

	return (
		<>
			<div className="relative h-[calc(100vh-5.75rem)]">
				<ContextMenu>
					<ContextMenuTrigger
						render={
							<section
								className="h-full outline-none"
								aria-label="Workspace content"
								data-prompt-type-to-focus-surface
								tabIndex={-1}
								onDragEnter={handleNativeFileDrag}
								onDragOver={handleNativeFileDrag}
								onDragLeave={handleNativeFileDragLeave}
								onDrop={handleNativeFileDrop}
								{...marqueeSurfaceProps}
							/>
						}
					>
						<ScrollArea className="h-full">
							<section className="min-h-full space-y-5 px-4 py-3 outline-none">
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
							</section>
						</ScrollArea>
					</ContextMenuTrigger>
					<ContextMenuContent className="w-56">
						<WorkspaceCreateContextMenuContent
							parentId={parentId}
							onCreateItem={onCreateItem}
						/>
					</ContextMenuContent>
				</ContextMenu>
				<WorkspaceSelectionActionBar
					selectedCount={selectedItems.length}
					onAskAi={handleAskAi}
					onMove={noopWorkspaceSelectionAction}
					onDelete={openDeleteSelectedAlert}
					onClear={clearSelection}
				/>
				<WorkspaceMarqueeOverlay rect={marqueeRect} />
				{isNativeFileDropTarget ? <WorkspaceNativeFileDropOverlay /> : null}
			</div>
			<WorkspaceContentActionDialogs
				renamingItem={renamingItem}
				deletingItem={deletingItem}
				deleteAlertOpen={deleteAlertOpen}
				items={items}
				onRenamingItemChange={setRenamingItem}
				onDeleteAlertOpenChange={setDeleteAlertOpen}
				onDeletingItemClear={clearDeletingItem}
			/>
			<DeleteWorkspaceItemsAlert
				open={deleteSelectedAlertOpen}
				workspaceId={workspaceId}
				itemIds={selectedItems.map((item) => item.id)}
				title="Delete selected items?"
				description={
					<WorkspaceDeleteSelectedItemsDescription
						selectedCount={selectedItems.length}
					/>
				}
				onOpenChange={setDeleteSelectedAlertOpen}
				onDeleted={clearSelection}
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

function WorkspaceNativeFileDropOverlay() {
	return (
		<div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/80 p-6 backdrop-blur-[2px]">
			<div className="flex min-h-40 w-full max-w-md flex-col items-center justify-center gap-3 rounded-md border border-primary/40 border-dashed bg-card/90 px-6 py-8 text-center shadow-lg ring-1 ring-primary/15">
				<div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
					<Upload className="size-5" aria-hidden="true" />
				</div>
				<div className="space-y-1">
					<p className="font-medium text-foreground text-sm">
						Drop {workspaceFileUploadTypeLabel} to upload
					</p>
					<p className="text-muted-foreground text-xs">
						Files will be added here.
					</p>
				</div>
			</div>
		</div>
	);
}

function hasNativeFiles(dataTransfer: DataTransfer) {
	return Array.from(dataTransfer.types).includes("Files");
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
			{deletingItem ? (
				<DeleteWorkspaceItemAlert
					open={deleteAlertOpen}
					item={deletingItem}
					items={items}
					onOpenChange={onDeleteAlertOpenChange}
					onClosed={onDeletingItemClear}
				/>
			) : null}
		</>
	);
}

function WorkspaceItemView({
	item,
	viewInstanceId,
	workspaceId,
	onRenameItem,
	onDeleteItem,
}: {
	item: WorkspaceItem;
	viewInstanceId: string;
	workspaceId: string;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
}) {
	if (item.type === "document") {
		return (
			<DocumentEditorSurface
				item={item}
				toolbarSlotId={viewInstanceId}
				workspaceId={workspaceId}
			/>
		);
	}

	if (isWorkspacePdfItem(item)) {
		return (
			<div className="h-[calc(100vh-5.75rem)]">
				<ContextMenu>
					<ContextMenuTrigger
						render={<section className="h-full min-h-0 overflow-hidden" />}
					>
						<Suspense fallback={<WorkspacePdfViewerSkeleton />}>
							<WorkspacePdfViewer
								item={item}
								toolbarSlotId={viewInstanceId}
								workspaceId={workspaceId}
							/>
						</Suspense>
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

	const {
		Icon: ItemIcon,
		iconClassName,
		surfaceClassName,
	} = getWorkspaceItemDisplay(item);

	return (
		<div className="h-[calc(100vh-5.75rem)]">
			<ContextMenu>
				<ContextMenuTrigger
					render={
						<section
							className={cn(
								"flex h-full min-h-0 items-center justify-center bg-muted/20",
								surfaceClassName,
							)}
						/>
					}
				>
					<div className="flex flex-col items-center gap-3 text-center">
						<ItemIcon
							className={cn("size-12", iconClassName)}
							strokeWidth={1.75}
							aria-hidden="true"
						/>
						<div className="space-y-1">
							<h2 className="font-medium text-foreground text-sm">
								{item.name}
							</h2>
						</div>
					</div>
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

function WorkspacePdfViewerSkeleton() {
	return (
		<div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 overflow-hidden bg-muted/20 px-4 text-center text-muted-foreground text-sm">
			<Spinner className="size-4" />
			<p>Loading PDF viewer...</p>
		</div>
	);
}
