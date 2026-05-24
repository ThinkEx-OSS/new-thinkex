import {
	BookOpen,
	Download,
	Ellipsis,
	FilePlus2,
	Search,
	X,
} from "lucide-react";
import { type ComponentType, useMemo, useState } from "react";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "#/components/ui/breadcrumb";
import { Button } from "#/components/ui/button";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import type { WorkspaceSummary } from "#/features/workspaces/contracts";
import { getWorkspaceDisplay } from "#/features/workspaces/model/display";
import {
	getWorkspaceItemDisplay,
	workspaceItemLearnCreateActions,
	workspaceItemPrimaryCreateActions,
} from "#/features/workspaces/model/item-display";
import { getWorkspaceBreadcrumbItems } from "#/features/workspaces/model/tree";
import type {
	WorkspaceItem,
	WorkspaceItemType,
} from "#/features/workspaces/model/types";

interface WorkspaceContextBarProps {
	workspace: WorkspaceSummary;
	activeItem?: WorkspaceItem;
	itemsById: Map<string, WorkspaceItem>;
	onCloseCurrentView: () => void;
	onNavigateToRoot: () => void;
	onNavigateToItem: (item: WorkspaceItem) => void;
	onCreateItem: (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => void;
}

export default function WorkspaceContextBar({
	workspace,
	activeItem,
	itemsById,
	onCloseCurrentView,
	onNavigateToRoot,
	onNavigateToItem,
	onCreateItem,
}: WorkspaceContextBarProps) {
	const isDocumentLikeView = Boolean(
		activeItem && activeItem.type !== "folder",
	);
	const { Icon: WorkspaceIcon, color } = getWorkspaceDisplay(workspace);
	const createParentId = activeItem?.type === "folder" ? activeItem.id : null;
	const breadcrumbs = getWorkspaceBreadcrumbItems(activeItem, itemsById);
	const [searchOpen, setSearchOpen] = useState(false);
	const searchableItems = useMemo(
		() =>
			Array.from(itemsById.values()).sort((first, second) =>
				first.name.localeCompare(second.name),
			),
		[itemsById],
	);

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
							/>
						</BreadcrumbItem>
						{breadcrumbs.map((item) => (
							<WorkspaceBreadcrumbItem
								key={item.id}
								item={item}
								isCurrent={item.id === activeItem?.id}
								onClick={() => onNavigateToItem(item)}
							/>
						))}
					</BreadcrumbList>
				</Breadcrumb>

				<div className="flex shrink-0 items-center gap-1">
					{isDocumentLikeView ? (
						<>
							<Button
								variant="ghost"
								size="sm"
								type="button"
								className="h-8 gap-1.5 px-2.5 text-sm text-muted-foreground hover:text-foreground"
							>
								<Download className="size-3.5" />
								<span className="hidden sm:inline">Export</span>
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								type="button"
								className="size-8.5 text-muted-foreground hover:text-foreground"
								aria-label="More item actions"
							>
								<Ellipsis className="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								type="button"
								className="size-8.5 text-muted-foreground hover:text-foreground"
								aria-label="Go up one level"
								onClick={onCloseCurrentView}
							>
								<X className="size-4" />
							</Button>
						</>
					) : (
						<>
							<Button
								variant="ghost"
								size="sm"
								type="button"
								className="h-8 gap-1.5 px-2.5 text-sm text-muted-foreground hover:text-foreground"
								onClick={() => setSearchOpen(true)}
							>
								<Search className="size-3.5" />
								<span className="hidden sm:inline">Search</span>
							</Button>
							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<Button
											variant="ghost"
											size="sm"
											type="button"
											className="h-8 gap-1.5 px-2.5 text-sm text-muted-foreground hover:text-foreground"
										/>
									}
								>
									<FilePlus2 className="size-3.5" />
									<span className="hidden sm:inline">New</span>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-56">
									{workspaceItemPrimaryCreateActions.map(
										({ type, label, description, Icon, iconClassName }) => (
											<DropdownMenuItem
												key={type}
												onClick={() =>
													onCreateItem({ type, parentId: createParentId })
												}
											>
												<Icon className={`size-4 ${iconClassName}`} />
												<span>{label}</span>
												{description ? (
													<span className="ml-auto text-xs text-muted-foreground">
														{description}
													</span>
												) : null}
											</DropdownMenuItem>
										),
									)}
									<DropdownMenuSub>
										<DropdownMenuSubTrigger>
											<BookOpen className="size-4 text-indigo-600 dark:text-indigo-400" />
											<span>Learn</span>
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent className="w-48">
											{workspaceItemLearnCreateActions.map(
												({ type, label, Icon, iconClassName }) => (
													<DropdownMenuItem
														key={type}
														onClick={() =>
															onCreateItem({ type, parentId: createParentId })
														}
													>
														<Icon className={`size-4 ${iconClassName}`} />
														<span>{label}</span>
													</DropdownMenuItem>
												),
											)}
										</DropdownMenuSubContent>
									</DropdownMenuSub>
								</DropdownMenuContent>
							</DropdownMenu>
						</>
					)}
				</div>
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
}: {
	item: WorkspaceItem;
	isCurrent: boolean;
	onClick: () => void;
}) {
	const { Icon, iconClassName } = getWorkspaceItemDisplay(item);

	return (
		<>
			<BreadcrumbSeparator className="text-muted-foreground/60" />
			<BreadcrumbItem className="min-w-0">
				<CrumbButton
					icon={Icon}
					label={item.name}
					iconClassName={iconClassName}
					isCurrent={isCurrent}
					onClick={onClick}
				/>
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
}: {
	icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
	label: string;
	iconClassName?: string;
	isCurrent: boolean;
	onClick: () => void;
}) {
	const iconColor = iconClassName ?? "text-muted-foreground";

	if (isCurrent) {
		return (
			<BreadcrumbPage className="flex min-w-0 items-center gap-1.5 truncate">
				<Icon className={`size-3.5 shrink-0 ${iconColor}`} aria-hidden={true} />
				<span className="truncate">{label}</span>
			</BreadcrumbPage>
		);
	}

	return (
		<BreadcrumbLink
			render={
				<Button
					variant="ghost"
					size="sm"
					type="button"
					className="h-auto min-w-0 justify-start gap-1.5 truncate rounded-sm px-0 py-0 font-normal text-muted-foreground hover:bg-transparent hover:text-foreground active:translate-y-0"
					onClick={onClick}
				/>
			}
		>
			<Icon className={`size-3.5 shrink-0 ${iconColor}`} aria-hidden={true} />
			<span className="truncate">{label}</span>
		</BreadcrumbLink>
	);
}
