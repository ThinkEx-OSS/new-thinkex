import {
	getWorkspaceItemDisplay,
	getWorkspaceItemTypeDisplay,
} from "#/features/workspaces/model/item-display";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { cn } from "#/lib/utils";

const MOCK_LAST_EDITED_LABEL = "Edited 2 days ago";

interface WorkspaceItemCardFooterProps {
	item: WorkspaceItem;
}

export function WorkspaceItemCardFooter({
	item,
}: WorkspaceItemCardFooterProps) {
	const { Icon, iconClassName } = getWorkspaceItemDisplay(item);
	const { label } = getWorkspaceItemTypeDisplay(item.type);

	return (
		<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
			<span className="flex min-w-0 items-center gap-1.5">
				<Icon
					className={cn("size-3.5 shrink-0", iconClassName)}
					strokeWidth={1.75}
					aria-hidden="true"
				/>
				<span className="truncate">{label}</span>
			</span>
			<span className="shrink-0">{MOCK_LAST_EDITED_LABEL}</span>
		</div>
	);
}
