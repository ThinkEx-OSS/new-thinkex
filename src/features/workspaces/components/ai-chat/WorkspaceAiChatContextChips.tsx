import { Eye, MessageSquare, X } from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "#/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import {
	getWorkspaceAiContextChips,
	type WorkspaceAiContextChip,
	type WorkspaceAiContextScope,
} from "#/features/workspaces/model/workspace-ai-context";
import type { WorkspaceSelectedMention } from "#/features/workspaces/model/workspace-selected-mentions";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";
import { cn } from "#/lib/utils";

const CONTEXT_CHIP_REMOVE_BUTTON_CLASSNAME =
	"-mr-1 size-5 shrink-0 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive";

export default function WorkspaceAiChatContextChips({
	context,
}: {
	context: WorkspaceAiContextScope;
}) {
	const removeAiContextItem = useWorkspaceUiStore(
		(state) => state.removeAiContextItem,
	);
	const removeSelectedMention = useWorkspaceUiStore(
		(state) => state.removeSelectedMention,
	);
	const chips = getWorkspaceAiContextChips(context);
	const activeChips = chips.filter((chip) => chip.isActiveVisible);
	const inactiveChips = chips.filter((chip) => !chip.isActiveVisible);
	const mentionChips = context.selectedMentions;

	if (chips.length === 0 && mentionChips.length === 0) {
		return null;
	}

	return (
		<div className="flex w-full min-w-0 flex-wrap items-center gap-1">
			{activeChips.map((chip) => (
				<WorkspaceAiChatContextChipRenderer
					key={chip.id}
					chip={chip}
					onRemove={() => removeAiContextItem(context.workspaceId, chip.id)}
				/>
			))}
			{mentionChips.map((mention) => (
				<WorkspaceAiChatSelectedMentionChip
					key={mention.id}
					mention={mention}
					onRemove={() =>
						removeSelectedMention(context.workspaceId, mention.id)
					}
				/>
			))}
			{inactiveChips.map((chip) => (
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
			canRemove={chip.isMarkedForAiContext}
			isActiveVisible={chip.isActiveVisible}
			item={chip.item}
			label={chip.label}
			path={chip.path}
			viewStateLabel={chip.viewStateLabel}
			onRemove={onRemove}
		/>
	);
}

function WorkspaceAiChatContextChip({
	canRemove,
	isActiveVisible,
	item,
	label,
	path,
	viewStateLabel,
	onRemove,
}: {
	canRemove: boolean;
	isActiveVisible: boolean;
	item: WorkspaceItem;
	label: string;
	path: string;
	viewStateLabel?: string;
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
				viewStateLabel={viewStateLabel}
			/>
			{canRemove ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					className={CONTEXT_CHIP_REMOVE_BUTTON_CLASSNAME}
					aria-label={`Remove ${label} from AI context`}
					onClick={onRemove}
				>
					<X className="size-3" />
				</Button>
			) : null}
		</div>
	);
}

function WorkspaceAiChatContextChipContent({
	Icon,
	isActiveVisible,
	iconClassName,
	label,
	viewStateLabel,
}: {
	Icon: ComponentType<{ className?: string }>;
	isActiveVisible: boolean;
	iconClassName?: string;
	label: string;
	viewStateLabel?: string;
}) {
	const LeadingIcon = isActiveVisible ? Eye : Icon;
	const leadingIconClassName = isActiveVisible ? "text-primary" : iconClassName;

	return (
		<>
			<LeadingIcon
				className={cn(
					"size-3 shrink-0 text-muted-foreground",
					leadingIconClassName,
				)}
				aria-label={isActiveVisible ? "active item" : undefined}
			/>
			<span className="min-w-0 truncate font-medium">{label}</span>
			{viewStateLabel ? (
				<span className="shrink-0 tabular-nums text-muted-foreground">
					{viewStateLabel}
				</span>
			) : null}
		</>
	);
}

function WorkspaceAiChatSelectedMentionChip({
	mention,
	onRemove,
}: {
	mention: WorkspaceSelectedMention;
	onRemove: () => void;
}) {
	const preview = getWorkspaceAiChatSelectedMentionPreview(mention);
	const chip = (
		<div
			className={getWorkspaceAiChatContextChipClassName(
				"border border-blue-200/80 bg-blue-50 text-blue-950 dark:border-blue-500/25 dark:bg-blue-500/15 dark:text-blue-50",
			)}
		>
			<WorkspaceAiChatSelectedMentionIcon />
			<span className="min-w-0 truncate font-medium">{preview}</span>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className={CONTEXT_CHIP_REMOVE_BUTTON_CLASSNAME}
				aria-label={`Remove ${mention.label} from AI context`}
				onClick={onRemove}
			>
				<X className="size-3" />
			</Button>
		</div>
	);

	return (
		<Tooltip>
			<TooltipTrigger render={chip} />
			<TooltipContent className="block max-w-md whitespace-pre-wrap break-words text-left leading-relaxed">
				{mention.text}
			</TooltipContent>
		</Tooltip>
	);
}

function WorkspaceAiChatSelectedMentionIcon() {
	return (
		<MessageSquare className="size-3 shrink-0 text-blue-600 dark:text-blue-300" />
	);
}

function getWorkspaceAiChatSelectedMentionPreview(
	mention: WorkspaceSelectedMention,
) {
	return mention.text.replace(/\s+/g, " ").trim();
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
		"flex min-h-6 min-w-0 max-w-48 items-center gap-1 rounded-md bg-muted px-1 py-0.5 text-xs dark:bg-input/30",
		"outline-none focus-visible:ring-2 focus-visible:ring-ring",
		className,
	);
}
