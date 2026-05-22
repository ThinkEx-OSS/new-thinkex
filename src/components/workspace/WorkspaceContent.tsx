import { FolderOpen } from "lucide-react";

import { Card, CardHeader, CardTitle } from "#/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { ScrollArea, ScrollBar } from "#/components/ui/scroll-area";
import type { WorkspaceItem } from "#/components/workspace/types";
import { cn } from "#/lib/utils";
import { getWorkspaceItemDisplay } from "#/lib/workspace-item-display";
import {
	getWorkspaceChildren,
	getWorkspaceItemMeta,
	splitWorkspaceChildren,
} from "#/lib/workspace-tree";

interface WorkspaceContentProps {
	items: WorkspaceItem[];
	activeItem?: WorkspaceItem;
	onOpenItem: (item: WorkspaceItem) => void;
}

export default function WorkspaceContent({
	items,
	activeItem,
	onOpenItem,
}: WorkspaceContentProps) {
	if (activeItem && activeItem.type !== "folder") {
		return <WorkspaceItemView item={activeItem} />;
	}

	const parentId = activeItem?.type === "folder" ? activeItem.id : null;
	const children = getWorkspaceChildren(items, parentId);
	const { folders, items: nonFolderItems } = splitWorkspaceChildren(children);

	return (
		<ScrollArea className="h-[calc(100vh-5.75rem)]">
			<div className="space-y-5 px-4 py-3">
				{folders.length > 0 ? (
					<section className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
						{folders.map((item) => (
							<WorkspaceItemCard
								key={item.id}
								item={item}
								meta={getWorkspaceItemMeta(item, items)}
								onOpenItem={onOpenItem}
							/>
						))}
					</section>
				) : null}
				{nonFolderItems.length > 0 ? (
					<section className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
						{nonFolderItems.map((item) => (
							<WorkspaceItemCard
								key={item.id}
								item={item}
								meta={getWorkspaceItemMeta(item, items)}
								onOpenItem={onOpenItem}
							/>
						))}
					</section>
				) : null}
				{children.length === 0 ? (
					<Empty className="border border-dashed bg-muted/20">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<FolderOpen />
							</EmptyMedia>
							<EmptyTitle>No items in this folder</EmptyTitle>
							<EmptyDescription>
								Items you add here will appear in this workspace view.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : null}
			</div>
			<ScrollBar className="w-1.5" />
		</ScrollArea>
	);
}

function WorkspaceItemCard({
	item,
	meta,
	onOpenItem,
}: {
	item: WorkspaceItem;
	meta: string;
	onOpenItem: (item: WorkspaceItem) => void;
}) {
	const {
		Icon: ItemIcon,
		iconClassName,
		surfaceClassName,
	} = getWorkspaceItemDisplay(item);

	return (
		<Card className="gap-0 overflow-hidden py-0 transition-all hover:bg-accent hover:shadow-md dark:hover:bg-accent/60">
			<button
				type="button"
				className="flex w-full flex-col text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				onClick={() => onOpenItem(item)}
			>
				<div
					className={cn(
						"flex aspect-[5/2] items-center justify-center bg-muted",
						surfaceClassName,
					)}
				>
					<ItemIcon
						className={cn("size-10", iconClassName)}
						strokeWidth={1.75}
						aria-hidden="true"
					/>
				</div>
				<CardHeader className="gap-2 py-5">
					<CardTitle>{item.name}</CardTitle>
					<p className="text-xs text-muted-foreground">{meta}</p>
				</CardHeader>
			</button>
		</Card>
	);
}

function WorkspaceItemView({ item }: { item: WorkspaceItem }) {
	return (
		<div className="px-4 py-3">
			<section className="flex min-h-64 items-center justify-center rounded-md border border-dashed bg-muted/20 text-sm text-muted-foreground">
				{item.name} content placeholder
			</section>
		</div>
	);
}
