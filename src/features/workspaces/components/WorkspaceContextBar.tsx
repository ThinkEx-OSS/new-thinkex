import { ChevronDown } from "lucide-react";
import { type ComponentType, useState } from "react";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "#/components/ui/breadcrumb";
import {
	Combobox,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "#/components/ui/combobox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import WorkspaceContextActions from "#/features/workspaces/components/WorkspaceContextActions";
import {
	DeleteWorkspaceItemAlert,
	RenameWorkspaceItemDialog,
} from "#/features/workspaces/components/WorkspaceItemActionDialogs";
import WorkspaceItemActionsMenu from "#/features/workspaces/components/WorkspaceItemActionsMenu";
import WorkspaceSettingsDialog from "#/features/workspaces/components/WorkspaceSettingsDialog";
import type {
	WorkspaceItemType,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import { getWorkspaceDisplay } from "#/features/workspaces/model/display";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import { getWorkspaceBreadcrumbItems } from "#/features/workspaces/model/tree";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { getWorkspaceBrowseParentId } from "#/features/workspaces/model/view";
import {
	formatAppHotkey,
	getAppHotkey,
	useAppHotkey,
} from "#/lib/hotkeys-core";

const breadcrumbContentClassName = "flex min-w-0 items-center gap-1.5 truncate";
const breadcrumbCurrentClassName = `${breadcrumbContentClassName} font-medium text-foreground`;
const breadcrumbLinkClassName = `${breadcrumbContentClassName} rounded-sm border-0 bg-transparent p-0 font-[inherit] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0`;

interface WorkspaceContextDialogState {
	searchOpen: boolean;
	settingsOpen: boolean;
	renamingItem: WorkspaceItem | null;
	deletingItem: WorkspaceItem | null;
	deleteAlertOpen: boolean;
}

const initialDialogState: WorkspaceContextDialogState = {
	searchOpen: false,
	settingsOpen: false,
	renamingItem: null,
	deletingItem: null,
	deleteAlertOpen: false,
};

interface WorkspaceContextBarProps {
	workspace: WorkspaceSummary;
	activeItem?: WorkspaceItem;
	itemsById: Map<string, WorkspaceItem>;
	onCreateItem: (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => void;
	onCloseItemView?: () => void;
	onNavigateToRoot: () => void;
	onNavigateToItem: (item: WorkspaceItem) => void;
}

export default function WorkspaceContextBar({
	workspace,
	activeItem,
	itemsById,
	onCreateItem,
	onCloseItemView,
	onNavigateToRoot,
	onNavigateToItem,
}: WorkspaceContextBarProps) {
	const { Icon: WorkspaceIcon, color } = getWorkspaceDisplay(workspace);
	const breadcrumbs = getWorkspaceBreadcrumbItems(activeItem, itemsById);
	const createParentId = getWorkspaceBrowseParentId(activeItem);
	const [dialogState, setDialogState] =
		useState<WorkspaceContextDialogState>(initialDialogState);
	const workspaceItems = Array.from(itemsById.values());
	const searchableItems = workspaceItems
		.slice()
		.sort((first, second) => first.name.localeCompare(second.name));
	const updateDialogState = (patch: Partial<WorkspaceContextDialogState>) =>
		setDialogState((current) => ({ ...current, ...patch }));
	const setSearchOpen = (searchOpen: boolean) =>
		updateDialogState({ searchOpen });
	const setSettingsOpen = (settingsOpen: boolean) =>
		updateDialogState({ settingsOpen });
	const setRenamingItem = (renamingItem: WorkspaceItem | null) =>
		updateDialogState({ renamingItem });
	const setDeleteAlertOpen = (deleteAlertOpen: boolean) =>
		updateDialogState({ deleteAlertOpen });
	const clearDeletingItem = () =>
		updateDialogState({ deletingItem: null, deleteAlertOpen: false });
	const openDeleteAlert = (deletingItem: WorkspaceItem) =>
		updateDialogState({ deletingItem, deleteAlertOpen: true });
	const {
		deleteAlertOpen,
		deletingItem,
		renamingItem,
		searchOpen,
		settingsOpen,
	} = dialogState;
	const searchHotkey = formatAppHotkey(
		getAppHotkey("workspace.search.open").hotkey,
	);

	useAppHotkey("workspace.search.open", () => {
		setSearchOpen(true);
	});

	return (
		<>
			<div className="flex h-11 items-center justify-between gap-3 bg-workspace-chrome-active px-4 text-sm">
				<Breadcrumb className="min-w-0">
					<BreadcrumbList className="flex-nowrap gap-1.5 overflow-hidden sm:gap-1.5">
						<BreadcrumbItem className="min-w-0">
							<CrumbButton
								icon={WorkspaceIcon}
								label={workspace.name}
								iconClassName={color.text}
								isCurrent={!activeItem}
								onClick={onNavigateToRoot}
								onCurrentClick={() => setSettingsOpen(true)}
							/>
						</BreadcrumbItem>
						{breadcrumbs.map((item) => (
							<WorkspaceBreadcrumbItem
								key={item.id}
								item={item}
								isCurrent={item.id === activeItem?.id}
								onClick={() => onNavigateToItem(item)}
								onRenameItem={setRenamingItem}
								onDeleteItem={openDeleteAlert}
							/>
						))}
					</BreadcrumbList>
				</Breadcrumb>

				<WorkspaceContextActions
					activeItem={activeItem}
					createParentId={createParentId}
					searchHotkey={searchHotkey}
					onCreateItem={onCreateItem}
					onSearch={() => setSearchOpen(true)}
					onCloseItemView={onCloseItemView}
				/>
			</div>
			<Dialog open={searchOpen} onOpenChange={setSearchOpen}>
				<DialogContent
					className="gap-3 p-3 sm:max-w-lg"
					showCloseButton={false}
				>
					<DialogHeader className="sr-only">
						<DialogTitle>Search workspace</DialogTitle>
						<DialogDescription>
							Search files and folders in this workspace.
						</DialogDescription>
					</DialogHeader>
					<Combobox<WorkspaceItem>
						items={searchableItems}
						itemToStringLabel={getSearchableItemLabel}
						itemToStringValue={(item) => item.id}
						isItemEqualToValue={(item, value) => item.id === value.id}
						value={null}
						inline
						autoHighlight
						onValueChange={(item) => {
							if (!item) {
								return;
							}
							onNavigateToItem(item);
							setSearchOpen(false);
						}}
					>
						<ComboboxInput
							autoFocus
							showTrigger={false}
							placeholder="Search workspace..."
							className="w-full"
						/>
						<ComboboxList className="max-h-80 p-1">
							<ComboboxEmpty>No items found.</ComboboxEmpty>
							<ComboboxGroup>
								{searchableItems.map((item, index) => {
									const { Icon, iconClassName, label } =
										getWorkspaceItemDisplay(item);

									return (
										<ComboboxItem key={item.id} value={item} index={index}>
											<Icon className={`size-4 ${iconClassName}`} />
											<span className="truncate">{item.name}</span>
											<span className="ml-auto text-xs text-muted-foreground">
												{label}
											</span>
										</ComboboxItem>
									);
								})}
							</ComboboxGroup>
						</ComboboxList>
					</Combobox>
				</DialogContent>
			</Dialog>
			<WorkspaceSettingsDialog
				workspace={workspace}
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
			/>
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
				items={workspaceItems}
				onOpenChange={setDeleteAlertOpen}
				onClosed={clearDeletingItem}
			/>
		</>
	);
}

function getSearchableItemLabel(item: WorkspaceItem) {
	const { label } = getWorkspaceItemDisplay(item);
	return `${item.name} ${label}`;
}

function WorkspaceBreadcrumbItem({
	item,
	isCurrent,
	onClick,
	onRenameItem,
	onDeleteItem,
}: {
	item: WorkspaceItem;
	isCurrent: boolean;
	onClick: () => void;
	onRenameItem: (item: WorkspaceItem) => void;
	onDeleteItem: (item: WorkspaceItem) => void;
}) {
	const { Icon, iconClassName } = getWorkspaceItemDisplay(item);

	return (
		<>
			<BreadcrumbSeparator className="text-muted-foreground/60" />
			<BreadcrumbItem className="min-w-0">
				{isCurrent ? (
					<WorkspaceItemActionsMenu
						item={item}
						align="start"
						trigger={
							<button
								type="button"
								className={breadcrumbCurrentClassName}
								aria-label={`Open actions for ${item.name}`}
							/>
						}
						triggerChildren={
							<CrumbContent
								icon={Icon}
								label={item.name}
								iconClassName={iconClassName}
								showDisclosure={true}
							/>
						}
						onRenameItem={onRenameItem}
						onDeleteItem={onDeleteItem}
					/>
				) : (
					<CrumbButton
						icon={Icon}
						label={item.name}
						iconClassName={iconClassName}
						isCurrent={false}
						onClick={onClick}
					/>
				)}
			</BreadcrumbItem>
		</>
	);
}

function CrumbButton({
	icon: Icon,
	label,
	iconClassName,
	isCurrent,
	onClick,
	onCurrentClick,
}: {
	icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
	label: string;
	iconClassName?: string;
	isCurrent: boolean;
	onClick: () => void;
	onCurrentClick?: () => void;
}) {
	const iconColor = iconClassName ?? "text-muted-foreground";

	if (isCurrent) {
		if (onCurrentClick) {
			return (
				<button
					type="button"
					className={breadcrumbCurrentClassName}
					onClick={onCurrentClick}
					aria-label={`Open settings for ${label}`}
				>
					<CrumbContent
						icon={Icon}
						label={label}
						iconClassName={iconColor}
						showDisclosure={true}
					/>
				</button>
			);
		}

		return (
			<BreadcrumbPage className={breadcrumbCurrentClassName}>
				<CrumbContent icon={Icon} label={label} iconClassName={iconColor} />
			</BreadcrumbPage>
		);
	}

	return (
		<BreadcrumbLink
			render={
				<button
					type="button"
					className={breadcrumbLinkClassName}
					onClick={onClick}
					aria-label={`Open ${label}`}
				/>
			}
		>
			<CrumbContent icon={Icon} label={label} iconClassName={iconColor} />
		</BreadcrumbLink>
	);
}

function CrumbContent({
	icon: Icon,
	label,
	iconClassName,
	showDisclosure = false,
}: {
	icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
	label: string;
	iconClassName: string;
	showDisclosure?: boolean;
}) {
	return (
		<>
			<Icon
				className={`size-3.5 shrink-0 ${iconClassName}`}
				aria-hidden={true}
			/>
			<span className="min-w-0 truncate">{label}</span>
			{showDisclosure ? (
				<ChevronDown
					className="size-3 shrink-0 text-muted-foreground"
					aria-hidden={true}
				/>
			) : null}
		</>
	);
}
