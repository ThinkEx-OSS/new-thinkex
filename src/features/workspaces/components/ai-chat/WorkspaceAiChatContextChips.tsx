import { Check, Eye, PanelTop } from "lucide-react";
import type { ComponentType } from "react";

import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "#/components/ui/hover-card";
import { useWorkspaceSelectedItems } from "#/features/workspaces/components/useWorkspaceSelection";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import {
	getWorkspaceAiContextChips,
	type WorkspaceAiContextChip,
	type WorkspaceAiContextIcon,
	type WorkspaceAiContextListItem,
	type WorkspaceAiContextScope,
} from "#/features/workspaces/model/workspace-ai-context";
import { cn } from "#/lib/utils";

export default function WorkspaceAiChatContextChips({
	context,
}: {
	context: WorkspaceAiContextScope;
}) {
	const selectedItems = useWorkspaceSelectedItems({
		itemsById: context.itemsById,
		workspaceId: context.workspaceId,
	});
	const chips = getWorkspaceAiContextChips({
		activeItem: context.activeItem,
		itemsById: context.itemsById,
		selectedItems,
		tabs: context.tabs,
	});

	if (chips.length === 0) {
		return null;
	}

	return (
		<div className="flex w-full min-w-0 flex-wrap items-center gap-1 pt-2">
			{chips.map((chip) => (
				<WorkspaceAiChatContextChipRenderer key={chip.id} chip={chip} />
			))}
		</div>
	);
}

function WorkspaceAiChatContextChipRenderer({
	chip,
}: {
	chip: WorkspaceAiContextChip;
}) {
	if (chip.type === "list") {
		return (
			<WorkspaceAiChatContextListChip
				ariaLabel={chip.ariaLabel}
				icon={chip.icon}
				items={chip.items}
				label={chip.label}
			/>
		);
	}

	return (
		<WorkspaceAiChatContextChip
			icon={chip.icon}
			item={chip.item}
			label={chip.label}
		/>
	);
}

function WorkspaceAiChatContextListChip({
	ariaLabel,
	icon,
	items,
	label,
}: {
	ariaLabel: string;
	icon: WorkspaceAiContextIcon;
	items: WorkspaceAiContextListItem[];
	label: string;
}) {
	const { Icon, iconClassName } = getWorkspaceAiChatContextChipIcon({ icon });

	return (
		<HoverCard>
			<HoverCardTrigger
				delay={250}
				render={
					<button
						type="button"
						className={getWorkspaceAiChatContextChipClassName("cursor-default")}
						aria-label={ariaLabel}
					/>
				}
			>
				<WorkspaceAiChatContextChipContent
					Icon={Icon}
					iconClassName={iconClassName}
					label={label}
				/>
			</HoverCardTrigger>
			<HoverCardContent
				align="start"
				side="top"
				className="w-64 rounded-md p-2"
			>
				<div className="max-h-64 space-y-1 overflow-y-auto">
					{items.map((item) => (
						<WorkspaceAiChatContextListRow key={item.id} item={item} />
					))}
				</div>
			</HoverCardContent>
		</HoverCard>
	);
}

function WorkspaceAiChatContextChip({
	icon,
	item,
	label,
}: {
	icon: WorkspaceAiContextIcon;
	item?: WorkspaceItem;
	label: string;
}) {
	const { Icon, iconClassName } = getWorkspaceAiChatContextChipIcon({
		icon,
		item,
	});

	return (
		<div className={getWorkspaceAiChatContextChipClassName()} title={label}>
			<WorkspaceAiChatContextChipContent
				Icon={Icon}
				iconClassName={iconClassName}
				label={label}
			/>
		</div>
	);
}

function WorkspaceAiChatContextChipContent({
	Icon,
	iconClassName,
	label,
}: {
	Icon: ComponentType<{ className?: string }>;
	iconClassName?: string;
	label: string;
}) {
	return (
		<>
			<Icon
				className={cn("size-3 shrink-0 text-muted-foreground", iconClassName)}
			/>
			<span className="min-w-0 truncate font-medium">{label}</span>
		</>
	);
}

function WorkspaceAiChatContextListRow({
	item,
}: {
	item: WorkspaceAiContextListItem;
}) {
	const itemDisplay = item.item ? getWorkspaceItemDisplay(item.item) : null;
	const Icon = itemDisplay?.Icon ?? PanelTop;

	return (
		<div className="flex min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-sm">
			<Icon
				className={cn(
					"size-3.5 shrink-0 text-muted-foreground",
					itemDisplay?.iconClassName,
				)}
			/>
			<span className="min-w-0 truncate">{item.label}</span>
		</div>
	);
}

function getWorkspaceAiChatContextChipIcon({
	icon,
	item,
}: {
	icon: WorkspaceAiContextIcon;
	item?: WorkspaceItem;
}): {
	Icon: ComponentType<{ className?: string }>;
	iconClassName?: string;
} {
	if (icon === "workspace-item" && item) {
		const { Icon, iconClassName } = getWorkspaceItemDisplay(item);

		return { Icon, iconClassName };
	}

	if (icon === "current-item") {
		return { Icon: Eye };
	}

	if (icon === "selected-items") {
		return { Icon: Check };
	}

	return { Icon: PanelTop };
}

function getWorkspaceAiChatContextChipClassName(className?: string) {
	return cn(
		"flex min-h-7 min-w-0 max-w-40 items-center gap-1 rounded-md bg-muted px-1.5 py-1.5 text-xs dark:bg-input/30",
		"outline-none focus-visible:ring-2 focus-visible:ring-ring",
		className,
	);
}
