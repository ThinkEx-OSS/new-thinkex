import { FolderOpen } from "lucide-react";
import { useRef, useState } from "react";

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
import { DocumentEditorSurface } from "#/features/workspaces/components/document-editor/DocumentEditorSurface";
import { useWorkspaceItemActionDialogState } from "#/features/workspaces/components/useWorkspaceItemActionDialogState";
import {
	useWorkspaceMarqueeSelection,
	type WorkspaceMarqueeRect,
} from "#/features/workspaces/components/useWorkspaceMarqueeSelection";
import { useWorkspaceSelection } from "#/features/workspaces/components/useWorkspaceSelection";
import { WorkspaceCreateContextMenuContent } from "#/features/workspaces/components/WorkspaceCreateMenu";
import { WorkspaceFileDropOverlay } from "#/features/workspaces/components/WorkspaceFileDropOverlay";
import { useWorkspaceFileUpload } from "#/features/workspaces/components/WorkspaceFileUploadProvider";
import WorkspaceFileViewer from "#/features/workspaces/components/WorkspaceFileViewer";
import {
	DeleteWorkspaceItemAlert,
	DeleteWorkspaceItemsAlert,
	RenameWorkspaceItemDialog,
	WorkspaceDeleteSelectedItemsDescription,
} from "#/features/workspaces/components/WorkspaceItemActionDialogs";
import { WorkspaceItemActionsContextMenuContent } from "#/features/workspaces/components/WorkspaceItemActionsMenu";
import WorkspaceItemCard from "#/features/workspaces/components/WorkspaceItemCard";
import { MoveWorkspaceItemsDialog } from "#/features/workspaces/components/WorkspaceMoveItemsDialog";
import WorkspaceSelectionActionBar from "#/features/workspaces/components/WorkspaceSelectionActionBar";
import { useWorkspaceMutationAccess } from "#/features/workspaces/components/workspace-mutation-access";
import type {
	WorkspaceItemType,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
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
import { workspaceFileUploadTypeLabel } from "#/features/workspaces/model/workspace-file";
import { useNativeFileDropTarget } from "#/lib/use-native-file-drop-target";
import { cn } from "#/lib/utils";

interface WorkspaceContentProps {
	instanceId?: string;
	items: WorkspaceItem[];
	activeItem?: WorkspaceItem;
	workspace: WorkspaceSummary;
	onCreateItem: (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => void;
	onAddItemsToAiContext?: (items: WorkspaceItem[]) => void;
	onOpenItem: (item: WorkspaceItem, options?: { background?: boolean }) => void;
}

type WorkspaceItemActionDialogsState = ReturnType<
	typeof useWorkspaceItemActionDialogState
>;

export default function WorkspaceContent({
	instanceId,
	items,
	activeItem,
	workspace,
	onAddItemsToAiContext,
	onCreateItem,
	onOpenItem,
}: WorkspaceContentProps) {
	const workspaceId = workspace.id;
	const actionDialogs = useWorkspaceItemActionDialogState();

	if (isWorkspaceItemView(activeItem)) {
		return (
			<>
				<WorkspaceItemView
					item={activeItem}
					viewInstanceId={instanceId ?? activeItem.id}
					workspaceId={workspaceId}
					onMoveItem={actionDialogs.openMoveDialog}
					onRenameItem={actionDialogs.setRenamingItem}
					onDeleteItem={actionDialogs.openDeleteAlert}
				/>
				<WorkspaceContentActionDialogs
					actionDialogs={actionDialogs}
					workspace={workspace}
					items={items}
				/>
			</>
		);
	}

	return (
		<WorkspaceBrowseContent
			actionDialogs={actionDialogs}
			activeItem={activeItem}
			items={items}
			workspace={workspace}
			onAddItemsToAiContext={onAddItemsToAiContext}
			onCreateItem={onCreateItem}
			onOpenItem={onOpenItem}
		/>
	);
}

function WorkspaceBrowseContent({
	actionDialogs,
	activeItem,
	items,
	workspace,
	onAddItemsToAiContext,
	onCreateItem,
	onOpenItem,
}: WorkspaceContentProps & {
	actionDialogs: WorkspaceItemActionDialogsState;
}) {
	const { capabilities } = useWorkspaceMutationAccess();
	const workspaceId = workspace.id;
	const [deleteSelectedAlertOpen, setDeleteSelectedAlertOpen] = useState(false);
	const [moveSelectedDialogOpen, setMoveSelectedDialogOpen] = useState(false);
	const [isNativeFileDropTarget, setIsNativeFileDropTarget] = useState(false);
	const browseSurfaceRef = useRef<HTMLElement>(null);
	const { uploadFiles } = useWorkspaceFileUpload();
	const parentId = getWorkspaceBrowseParentId(activeItem);
	const children = getWorkspaceChildren(items, parentId);
	const { folders, items: nonFolderItems } = splitWorkspaceChildren(children);
	const handleNativeFileDrop = (files: FileList) => {
		if (!capabilities.canMutateContent) {
			return;
		}

		uploadFiles(Array.from(files), parentId);
	};
	useNativeFileDropTarget({
		enabled: capabilities.canMutateContent,
		onActiveChange: setIsNativeFileDropTarget,
		onDrop: handleNativeFileDrop,
		targetRef: browseSurfaceRef,
	});
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
	const openMoveSelectedDialog = () => {
		if (selectedItems.length === 0) {
			return;
		}

		setMoveSelectedDialogOpen(true);
	};

	return (
		<>
			<div className="relative h-full min-h-0">
				<ContextMenu>
					<ContextMenuTrigger
						render={
							<section
								ref={browseSurfaceRef}
								className="flex h-full flex-col gap-5 overflow-y-auto px-4 py-3 outline-none"
								aria-label="Workspace content"
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
								onMoveItem={actionDialogs.openMoveDialog}
								onRenameItem={actionDialogs.setRenamingItem}
								onDeleteItem={actionDialogs.openDeleteAlert}
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
								onMoveItem={actionDialogs.openMoveDialog}
								onRenameItem={actionDialogs.setRenamingItem}
								onDeleteItem={actionDialogs.openDeleteAlert}
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
										{capabilities.canMutateContent
											? "Items you add here will appear in this workspace view."
											: "This folder is empty."}
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
				<WorkspaceSelectionActionBar
					selectedCount={selectedItems.length}
					onAskAi={handleAskAi}
					onMove={openMoveSelectedDialog}
					onDelete={openDeleteSelectedAlert}
					onClear={clearSelection}
				/>
				<WorkspaceMarqueeOverlay rect={marqueeRect} />
				{isNativeFileDropTarget ? (
					<WorkspaceFileDropOverlay
						description="Files will be added here."
						title={`Drop ${workspaceFileUploadTypeLabel} to upload`}
					/>
				) : null}
			</div>
			<WorkspaceContentActionDialogs
				actionDialogs={actionDialogs}
				workspace={workspace}
				items={items}
			/>
			<MoveWorkspaceItemsDialog
				open={moveSelectedDialogOpen}
				workspace={workspace}
				items={items}
				itemIds={selectedItems.map((item) => item.id)}
				showToast
				onOpenChange={setMoveSelectedDialogOpen}
				onMoved={clearSelection}
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
	onMoveItem,
	onRenameItem,
	onDeleteItem,
	onSelectionChange,
	onItemElementChange,
}: {
	items: WorkspaceItem[];
	allItems: WorkspaceItem[];
	selectedItemIds: ReadonlySet<string>;
	onOpenItem: (item: WorkspaceItem, options?: { background?: boolean }) => void;
	onMoveItem: (item: WorkspaceItem) => void;
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
					onMoveItem={onMoveItem}
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
			className="pointer-events-none fixed z-20 rounded-sm border border-blue-500/80 bg-blue-500/20 shadow-[0_0_0_1px_rgba(59,130,246,0.35)_inset]"
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
	actionDialogs,
	workspace,
	items,
}: {
	actionDialogs: WorkspaceItemActionDialogsState;
	workspace: WorkspaceSummary;
	items: WorkspaceItem[];
}) {
	return (
		<>
			<RenameWorkspaceItemDialog
				item={actionDialogs.renamingItem}
				onOpenChange={(open) => {
					if (!open) {
						actionDialogs.setRenamingItem(null);
					}
				}}
			/>
			{actionDialogs.deletingItem ? (
				<DeleteWorkspaceItemAlert
					open={actionDialogs.deleteAlertOpen}
					item={actionDialogs.deletingItem}
					items={items}
					onOpenChange={actionDialogs.setDeleteAlertOpen}
					onClosed={actionDialogs.clearDeletingItem}
				/>
			) : null}
			{actionDialogs.movingItem ? (
				<MoveWorkspaceItemsDialog
					open={actionDialogs.moveDialogOpen}
					workspace={workspace}
					items={items}
					itemIds={[actionDialogs.movingItem.id]}
					onOpenChange={actionDialogs.setMoveDialogOpen}
					onMoved={actionDialogs.clearMovingItem}
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
	onMoveItem,
	onDeleteItem,
}: {
	item: WorkspaceItem;
	viewInstanceId: string;
	workspaceId: string;
	onMoveItem: (item: WorkspaceItem) => void;
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

	if (item.type === "file") {
		return (
			<WorkspaceFileViewer
				item={item}
				toolbarSlotId={viewInstanceId}
				workspaceId={workspaceId}
				onMoveItem={onMoveItem}
				onRenameItem={onRenameItem}
				onDeleteItem={onDeleteItem}
			/>
		);
	}

	const {
		Icon: ItemIcon,
		iconClassName,
		surfaceClassName,
	} = getWorkspaceItemDisplay(item);

	return (
		<div className="h-full min-h-0">
			<ContextMenu>
				<ContextMenuTrigger
					render={
						<section
							className={cn(
								"flex h-full min-h-0 items-center justify-center bg-background",
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
					onMoveItem={onMoveItem}
					onRenameItem={onRenameItem}
					onDeleteItem={onDeleteItem}
				/>
			</ContextMenu>
		</div>
	);
}
