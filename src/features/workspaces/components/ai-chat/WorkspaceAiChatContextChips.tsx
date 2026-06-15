import { Eye, X } from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "#/components/ui/button";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import {
	getWorkspaceAiContextChips,
	type WorkspaceAiContextChip,
	type WorkspaceAiContextScope,
} from "#/features/workspaces/model/workspace-ai-context";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";
import { cn } from "#/lib/utils";

export default function WorkspaceAiChatContextChips({
	context,
}: {
	context: WorkspaceAiContextScope;
}) {
	const removeAiContextItem = useWorkspaceUiStore(
		(state) => state.removeAiContextItem,
	);
	const chips = getWorkspaceAiContextChips(context);

	if (chips.length === 0) {
		return null;
	}

	return (
		<div className="flex w-full min-w-0 flex-wrap items-center gap-1 pt-2">
			{chips.map((chip) => (
				<WorkspaceAiChatContextChipRenderer
					key={chip.id}
					chip={chip}
					onRemove={() => removeAiContextItem(context.workspaceId, chip.id)}
				/>
			))}
		</div>
	);
}

function WorkspaceAiChatContextChipRenderer({
	chip,
	onRemove,
}: {
	chip: WorkspaceAiContextChip;
	onRemove: () => void;
}) {
	return (
		<WorkspaceAiChatContextChip
			isActiveVisible={chip.isActiveVisible}
			item={chip.item}
			label={chip.label}
			path={chip.path}
			onRemove={onRemove}
		/>
	);
}

function WorkspaceAiChatContextChip({
	isActiveVisible,
	item,
	label,
	path,
	onRemove,
}: {
	isActiveVisible: boolean;
	item: WorkspaceItem;
	label: string;
	path: string;
	onRemove: () => void;
}) {
	const { Icon, iconClassName } = getWorkspaceAiChatContextChipIcon(item);

	return (
		<div className={getWorkspaceAiChatContextChipClassName()} title={path}>
			<WorkspaceAiChatContextChipContent
				Icon={Icon}
				isActiveVisible={isActiveVisible}
				iconClassName={iconClassName}
				label={label}
			/>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className="-mr-1 size-5 shrink-0 text-muted-foreground hover:text-foreground"
				aria-label={`Remove ${label} from AI context`}
				onClick={onRemove}
			>
				<X className="size-3" />
			</Button>
		</div>
	);
}

function WorkspaceAiChatContextChipContent({
	Icon,
	isActiveVisible,
	iconClassName,
	label,
}: {
	Icon: ComponentType<{ className?: string }>;
	isActiveVisible: boolean;
	iconClassName?: string;
	label: string;
}) {
	return (
		<>
			<Icon
				className={cn("size-3 shrink-0 text-muted-foreground", iconClassName)}
			/>
			<span className="min-w-0 truncate font-medium">{label}</span>
			{isActiveVisible ? (
				<Eye
					className="size-3 shrink-0 text-primary"
					aria-label="Active item"
				/>
			) : null}
		</>
	);
}

function getWorkspaceAiChatContextChipIcon(item: WorkspaceItem): {
	Icon: ComponentType<{ className?: string }>;
	iconClassName?: string;
} {
	const { Icon, iconClassName } = getWorkspaceItemDisplay(item);

	return { Icon, iconClassName };
}

function getWorkspaceAiChatContextChipClassName(className?: string) {
	return cn(
		"flex min-h-7 min-w-0 max-w-48 items-center gap-1 rounded-md bg-muted px-1.5 py-1 text-xs dark:bg-input/30",
		"outline-none focus-visible:ring-2 focus-visible:ring-ring",
		className,
	);
}
