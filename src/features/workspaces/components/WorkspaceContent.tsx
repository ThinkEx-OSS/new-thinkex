import { Eye, FileText, FolderOpen, Image } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "#/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "#/components/ui/context-menu";
import {
	Empty,
	EmptyContent,
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
import { useWorkspaceFileIntake } from "#/features/workspaces/components/WorkspaceFileIntakeProvider";
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
import { useWorkspacePaneHotkey } from "#/features/workspaces/components/WorkspacePaneRuntime";
import WorkspaceSelectionActionBar from "#/features/workspaces/components/WorkspaceSelectionActionBar";
import { useWorkspaceMutationAccess } from "#/features/workspaces/components/workspace-mutation-access";
import type { WorkspaceItemType, WorkspaceSummary } from "#/features/workspaces/contracts";
import {
	getWorkspaceItemDisplay,
	workspaceItemAcquisitionActions,
	workspaceItemPrimaryCreateActions,
} from "#/features/workspaces/model/item-display";
import { workspaceColors } from "#/features/workspaces/model/workspace-colors";
import { getWorkspaceChildren, splitWorkspaceChildren } from "#/features/workspaces/model/tree";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { getWorkspaceBrowseParentId, isWorkspaceItemView } from "#/features/workspaces/model/view";
import { workspaceUploadTypeLabel } from "#/features/workspaces/upload/workspace-upload-intake";
import { eventTargetsPreventTypeToFocus } from "#/lib/keyboard-event-target";
import { useNativeFileDropTarget } from "#/lib/use-native-file-drop-target";
import { cn } from "#/lib/utils";

interface WorkspaceContentProps {
	instanceId?: string;
	items: WorkspaceItem[];
	activeItem?: WorkspaceItem;
	workspace: WorkspaceSummary;
	onCreateItem: (input: { type: WorkspaceItemType; parentId: string | null }) => void;
	onOpenItem: (item: WorkspaceItem, options?: { background?: boolean }) => void;
}

type WorkspaceItemActionDialogsState = ReturnType<typeof useWorkspaceItemActionDialogState>;

export default function WorkspaceContent({
	instanceId,
	items,
	activeItem,
	workspace,
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
	const { requestFileUpload, uploadFiles } = useWorkspaceFileIntake();
	const parentId = getWorkspaceBrowseParentId(activeItem);
	const children = getWorkspaceChildren(items, parentId);
	const { folders, items: nonFolderItems } = splitWorkspaceChildren(children);
	const isWorkspaceRoot = parentId === null;
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
	const { clearSelection, selectedItemIds, selectedItems, setItemSelected, setSelectedItemIds } =
		useWorkspaceSelection({
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

	const handleDeleteSelectedHotkey = (event: KeyboardEvent) => {
		if (
			selectedItems.length === 0 ||
			deleteSelectedAlertOpen ||
			moveSelectedDialogOpen ||
			eventTargetsPreventTypeToFocus(event)
		) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		openDeleteSelectedAlert();
	};

	useWorkspacePaneHotkey("Backspace", handleDeleteSelectedHotkey, {
		ignoreInputs: true,
		preventDefault: false,
		stopPropagation: false,
	});

	useWorkspacePaneHotkey("Delete", handleDeleteSelectedHotkey, {
		ignoreInputs: true,
		preventDefault: false,
		stopPropagation: false,
	});

	return (
		<>
			<div className="relative h-full min-h-0">
				<ContextMenu>
					<ContextMenuTrigger
						render={
							<section
								data-scroll-root
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
							<WorkspaceBrowseEmptyState
								canMutateContent={capabilities.canMutateContent}
								isWorkspaceRoot={isWorkspaceRoot}
								onCreateItem={onCreateItem}
								parentId={parentId}
								onUploadFiles={() => requestFileUpload(parentId)}
							/>
						) : null}
					</ContextMenuTrigger>
					<ContextMenuContent className="w-56">
						<WorkspaceCreateContextMenuContent parentId={parentId} onCreateItem={onCreateItem} />
					</ContextMenuContent>
				</ContextMenu>
				<WorkspaceSelectionActionBar
					selectedCount={selectedItems.length}
					onMove={openMoveSelectedDialog}
					onDelete={openDeleteSelectedAlert}
					onClear={clearSelection}
				/>
				<WorkspaceMarqueeOverlay rect={marqueeRect} />
				{isNativeFileDropTarget ? (
					<WorkspaceFileDropOverlay
						description="Files will be added here."
						title={`Drop ${workspaceUploadTypeLabel} to upload`}
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
					<WorkspaceDeleteSelectedItemsDescription selectedCount={selectedItems.length} />
				}
				onOpenChange={setDeleteSelectedAlertOpen}
				onDeleted={clearSelection}
			/>
		</>
	);
}

function WorkspaceBrowseEmptyState({
	canMutateContent,
	isWorkspaceRoot,
	onCreateItem,
	parentId,
	onUploadFiles,
}: {
	canMutateContent: boolean;
	isWorkspaceRoot: boolean;
	onCreateItem: (input: { type: WorkspaceItemType; parentId: string | null }) => void;
	parentId: string | null;
	onUploadFiles: () => void;
}) {
	if (!isWorkspaceRoot) {
		return (
			<Empty className="border border-dashed bg-muted/20">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FolderOpen />
					</EmptyMedia>
					<EmptyTitle>This folder is empty</EmptyTitle>
					<EmptyDescription>Items added here will appear in this folder.</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	if (!canMutateContent) {
		return (
			<Empty className="border border-dashed bg-muted/20">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Eye />
					</EmptyMedia>
					<EmptyTitle>This workspace is empty</EmptyTitle>
					<EmptyDescription>
						An editor needs to add the first items before anything appears here.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<Empty className="border border-dashed bg-muted/20">
			<EmptyHeader>
				<EmptyMedia>
					<WorkspaceRootEmptyMedia />
				</EmptyMedia>
				<EmptyTitle>Add your first files</EmptyTitle>
				<EmptyDescription>
					Drag files into the workspace or click New to get started.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<div className="grid w-full max-w-[15.5rem] grid-cols-3 gap-2">
					{workspaceItemPrimaryCreateActions.map(({ type, label, Icon, iconClassName }) => (
						<Button
							key={type}
							type="button"
							variant="outline"
							className="h-auto flex-col gap-1.5 px-3 py-2"
							onClick={() => onCreateItem({ type, parentId })}
						>
							<Icon className={cn("size-5", iconClassName)} />
							<span className="text-xs">{label}</span>
						</Button>
					))}
					{workspaceItemAcquisitionActions
						.filter((action) => action.id === "upload-file")
						.map(({ id, label, Icon, iconClassName, disabled }) => (
							<Button
								key={id}
								type="button"
								variant="outline"
								disabled={disabled}
								className="h-auto flex-col gap-1.5 px-3 py-2"
								onClick={id === "upload-file" ? onUploadFiles : undefined}
							>
								<Icon className={cn("size-5", iconClassName)} />
								<span className="text-xs">{label}</span>
							</Button>
						))}
				</div>
			</EmptyContent>
		</Empty>
	);
}

const workspaceRootEmptyMediaIcons = [
	{
		Icon: FolderOpen,
		iconClassName: workspaceColors.amber.iconClassName,
		className: "translate-x-7 translate-y-4 rotate-[10deg]",
	},
	{
		Icon: FileText,
		iconClassName: workspaceColors.sky.iconClassName,
		className: "-translate-y-2",
	},
	{
		Icon: Image,
		iconClassName: workspaceColors.emerald.iconClassName,
		className: "-translate-x-7 translate-y-4 -rotate-[10deg]",
	},
] as const;

function WorkspaceRootEmptyMedia() {
	return (
		<div className="relative flex h-18 w-24 items-center justify-center">
			{workspaceRootEmptyMediaIcons.map(({ Icon, className, iconClassName }) => (
				<div
					key={`${Icon.displayName ?? Icon.name}-${className}`}
					className={cn("absolute flex items-center justify-center", className)}
				>
					<Icon className={cn("size-8", iconClassName)} strokeWidth={1.9} aria-hidden="true" />
				</div>
			))}
		</div>
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

function WorkspaceMarqueeOverlay({ rect }: { rect: WorkspaceMarqueeRect | null }) {
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
			<DocumentEditorSurface item={item} toolbarSlotId={viewInstanceId} workspaceId={workspaceId} />
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

	const { Icon: ItemIcon, iconClassName, surfaceClassName } = getWorkspaceItemDisplay(item);

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
							<h2 className="font-medium text-foreground text-sm">{item.name}</h2>
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
