import { Check, type LucideIcon, Search } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import {
	filterWorkspaceItemTreePickerNodes,
	type WorkspaceItemTreePickerNode,
} from "#/features/workspaces/model/workspace-item-tree-picker";
import { cn } from "#/lib/utils";

interface WorkspaceItemTreePickerDialogProps {
	open: boolean;
	title: string;
	nodes: readonly WorkspaceItemTreePickerNode[];
	selectedValue: string | null;
	rootIcon: LucideIcon;
	rootIconClassName: string;
	confirmLabel: string;
	confirmDisabled?: boolean;
	confirming?: boolean;
	emptyMessage?: string;
	footerStart?: ReactNode;
	onOpenChange: (open: boolean) => void;
	onSelectedValueChange: (value: string | null) => void;
	onConfirm: () => void;
}

export function WorkspaceItemTreePickerDialog({
	open,
	title,
	nodes,
	selectedValue,
	rootIcon,
	rootIconClassName,
	confirmLabel,
	confirmDisabled = false,
	confirming = false,
	emptyMessage = "No matching folders.",
	footerStart,
	onOpenChange,
	onSelectedValueChange,
	onConfirm,
}: WorkspaceItemTreePickerDialogProps) {
	const [query, setQuery] = useState("");
	const rows = getWorkspaceItemTreePickerRows(
		filterWorkspaceItemTreePickerNodes(nodes, query),
	);
	const hasFooterStart = footerStart !== undefined && footerStart !== null;
	const closePicker = (nextOpen: boolean) => {
		if (!nextOpen) {
			setQuery("");
		}

		onOpenChange(nextOpen);
	};

	return (
		<Dialog open={open} onOpenChange={closePicker}>
			<DialogContent className="gap-0 p-0 sm:max-w-lg">
				<DialogHeader className="px-5 pt-5 pr-12 pb-4">
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<div className="px-5 pb-4">
					<div className="relative">
						<Search
							className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search folders"
							className="h-8 pl-8"
							aria-label="Search folders"
							autoFocus
						/>
					</div>
				</div>

				<ul
					className="flex max-h-80 flex-col gap-1 overflow-y-auto border-y px-5 py-3"
					aria-label={title}
				>
					{rows.length > 0 ? (
						rows.map((node) => (
							<WorkspaceItemTreePickerRow
								key={node.id}
								node={node}
								rootIcon={rootIcon}
								rootIconClassName={rootIconClassName}
								selected={node.value === selectedValue}
								onSelect={() => onSelectedValueChange(node.value)}
							/>
						))
					) : (
						<li className="px-3 py-8 text-center text-muted-foreground text-sm">
							{emptyMessage}
						</li>
					)}
				</ul>

				<DialogFooter
					className={cn(
						"items-center px-5 pt-4 pb-5",
						hasFooterStart && "sm:justify-between",
					)}
				>
					{hasFooterStart ? <div className="min-w-0">{footerStart}</div> : null}
					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button
							type="button"
							variant="outline"
							onClick={() => closePicker(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							disabled={confirmDisabled || confirming}
							onClick={() => {
								setQuery("");
								onConfirm();
							}}
						>
							{confirmLabel}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function WorkspaceItemTreePickerRow({
	node,
	rootIcon,
	rootIconClassName,
	selected,
	onSelect,
}: {
	node: WorkspaceItemTreePickerNode;
	rootIcon: LucideIcon;
	rootIconClassName: string;
	selected: boolean;
	onSelect: () => void;
}) {
	const itemDisplay = node.item ? getWorkspaceItemDisplay(node.item) : null;
	const Icon = itemDisplay?.Icon ?? rootIcon;
	const iconClassName = itemDisplay?.iconClassName ?? rootIconClassName;

	return (
		<li className="flex items-center" style={{ paddingLeft: node.depth * 14 }}>
			<button
				type="button"
				className={cn(
					"flex h-9 min-w-0 flex-1 items-center gap-2 rounded-sm px-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40",
					selected && "bg-muted text-foreground",
				)}
				onClick={onSelect}
				aria-pressed={selected}
			>
				<Icon
					className={cn("size-4 shrink-0", iconClassName)}
					aria-hidden="true"
				/>
				<span className="min-w-0 flex-1 truncate">{node.label}</span>
				{selected ? (
					<Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
				) : null}
			</button>
		</li>
	);
}

function getWorkspaceItemTreePickerRows(
	nodes: readonly WorkspaceItemTreePickerNode[],
) {
	const rows: WorkspaceItemTreePickerNode[] = [];

	for (const node of nodes) {
		rows.push(node);
		rows.push(...getWorkspaceItemTreePickerRows(node.children));
	}

	return rows;
}
