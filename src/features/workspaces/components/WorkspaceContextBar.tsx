import {
	BookOpen,
	Download,
	Ellipsis,
	FilePlus2,
	Search,
	X,
} from "lucide-react";
import type { ComponentType } from "react";

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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { getWorkspaceDisplay } from "#/features/workspaces/model/display";
import {
	getWorkspaceItemDisplay,
	workspaceItemLearnCreateActions,
	workspaceItemPrimaryCreateActions,
} from "#/features/workspaces/model/item-display";
import { getWorkspaceBreadcrumbItems } from "#/features/workspaces/model/tree";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import type { WorkspaceSummary } from "#/lib/api/contracts";

interface WorkspaceContextBarProps {
	workspace: WorkspaceSummary;
	activeItem?: WorkspaceItem;
	itemsById: Map<string, WorkspaceItem>;
	onCloseCurrentView: () => void;
	onNavigateToRoot: () => void;
	onNavigateToItem: (item: WorkspaceItem) => void;
}

export default function WorkspaceContextBar({
	workspace,
	activeItem,
	itemsById,
	onCloseCurrentView,
	onNavigateToRoot,
	onNavigateToItem,
}: WorkspaceContextBarProps) {
	const isDocumentLikeView = Boolean(
		activeItem && activeItem.type !== "folder",
	);
	const { Icon: WorkspaceIcon, accent } = getWorkspaceDisplay(workspace);
	const breadcrumbs = getWorkspaceBreadcrumbItems(activeItem, itemsById);

	return (
		<div className="flex h-11 items-center justify-between gap-3 border-b border-border/70 bg-muted/30 px-4 text-sm">
			<Breadcrumb className="min-w-0">
				<BreadcrumbList className="flex-nowrap gap-1.5 overflow-hidden sm:gap-1.5">
					<BreadcrumbItem className="min-w-0">
						<CrumbButton
							icon={WorkspaceIcon}
							label={workspace.name}
							iconClassName={accent.text}
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
						>
							<Search className="size-3.5" />
							<span className="hidden sm:inline">Search</span>
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									type="button"
									className="h-8 gap-1.5 px-2.5 text-sm text-muted-foreground hover:text-foreground"
								>
									<FilePlus2 className="size-3.5" />
									<span className="hidden sm:inline">New</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								{workspaceItemPrimaryCreateActions.map(
									({ type, label, description, Icon, iconClassName }) => (
										<DropdownMenuItem key={type}>
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
												<DropdownMenuItem key={type}>
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
	);
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
		<BreadcrumbLink asChild>
			<button
				type="button"
				className="flex min-w-0 items-center gap-1.5 truncate rounded-sm font-normal text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
				onClick={onClick}
			>
				<Icon className={`size-3.5 shrink-0 ${iconColor}`} aria-hidden={true} />
				<span className="truncate">{label}</span>
			</button>
		</BreadcrumbLink>
	);
}
