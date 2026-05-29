import { EllipsisVertical, Search, X } from "lucide-react";

import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Kbd } from "#/components/ui/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import WorkspaceCreateMenu from "#/features/workspaces/components/WorkspaceCreateMenu";
import type { WorkspaceItemType } from "#/features/workspaces/contracts";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import type { WorkspaceItemContextAction } from "#/features/workspaces/model/object-registry";
import type { WorkspaceItem } from "#/features/workspaces/model/types";

interface WorkspaceContextActionsProps {
	activeItem?: WorkspaceItem;
	createParentId: string | null;
	searchHotkey: string;
	onCreateItem: (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => void;
	onSearch: () => void;
	onCloseItemView?: () => void;
}

export default function WorkspaceContextActions({
	activeItem,
	createParentId,
	searchHotkey,
	onCreateItem,
	onSearch,
	onCloseItemView,
}: WorkspaceContextActionsProps) {
	return (
		<div className="flex shrink-0 items-center gap-1">
			{activeItem && activeItem.type !== "folder" ? (
				<WorkspaceItemContextActions item={activeItem} />
			) : (
				<>
					<WorkspaceSearchAction hotkey={searchHotkey} onSearch={onSearch} />
					<WorkspaceCreateMenu
						parentId={createParentId}
						onCreateItem={onCreateItem}
					/>
					{activeItem ? (
						<WorkspaceItemOverflowActions
							actions={getWorkspaceItemDisplay(activeItem).contextActions}
							item={activeItem}
						/>
					) : null}
				</>
			)}
			{onCloseItemView ? (
				<Button
					variant="ghost"
					size="icon-sm"
					type="button"
					className="size-8.5 text-muted-foreground hover:text-foreground"
					aria-label="Close item"
					onClick={onCloseItemView}
				>
					<X className="size-4" />
				</Button>
			) : null}
		</div>
	);
}

function WorkspaceSearchAction({
	hotkey,
	onSearch,
}: {
	hotkey: string;
	onSearch: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant="ghost"
						size="sm"
						type="button"
						className="h-8 gap-1.5 px-2.5 text-sm text-muted-foreground hover:text-foreground"
						onClick={onSearch}
					>
						<Search className="size-3.5" />
						<span className="hidden sm:inline">Search</span>
					</Button>
				}
			/>
			<TooltipContent>
				<span>Search</span>
				<Kbd>{hotkey}</Kbd>
			</TooltipContent>
		</Tooltip>
	);
}

function WorkspaceItemContextActions({ item }: { item: WorkspaceItem }) {
	const { contextActions } = getWorkspaceItemDisplay(item);
	const actions = contextActions;
	const primaryActions = actions.slice(0, 2);
	const overflowActions = actions.slice(2);

	return (
		<>
			{primaryActions.map((action) => (
				<Button
					key={action.id}
					variant="ghost"
					size="sm"
					type="button"
					disabled
					className="h-8 gap-1.5 px-2.5 text-sm text-muted-foreground"
				>
					<action.icon className="size-3.5" />
					<span className="hidden sm:inline">{action.label}</span>
				</Button>
			))}
			{overflowActions.length > 0 ? (
				<WorkspaceItemOverflowActions actions={overflowActions} item={item} />
			) : null}
		</>
	);
}

function WorkspaceItemOverflowActions({
	actions,
	item,
}: {
	actions: readonly WorkspaceItemContextAction[];
	item: WorkspaceItem;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="icon-sm"
						type="button"
						className="size-8.5 text-muted-foreground hover:text-foreground"
						aria-label={`Open actions for ${item.name}`}
					/>
				}
			>
				<EllipsisVertical className="size-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				{actions.map((action) => (
					<DropdownMenuItem key={action.id} disabled>
						<action.icon className="size-4" />
						<span>{action.label}</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
