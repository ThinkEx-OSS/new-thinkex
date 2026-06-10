import { Search, X } from "lucide-react";

import { Button } from "#/components/ui/button";
import { Kbd } from "#/components/ui/kbd";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import WorkspaceCreateMenu from "#/features/workspaces/components/WorkspaceCreateMenu";
import type { WorkspaceItemType } from "#/features/workspaces/contracts";
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
	const showBrowseActions = !activeItem || activeItem.type === "folder";

	return (
		<div className="flex shrink-0 items-center gap-1">
			{showBrowseActions ? (
				<>
					<WorkspaceSearchAction hotkey={searchHotkey} onSearch={onSearch} />
					<WorkspaceCreateMenu
						parentId={createParentId}
						onCreateItem={onCreateItem}
					/>
				</>
			) : null}
			{onCloseItemView ? (
				<Button
					variant="ghost"
					size="icon-sm"
					type="button"
					className="size-8.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
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
