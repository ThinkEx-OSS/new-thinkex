import { FileQuestion } from "lucide-react";

import { Card, CardHeader, CardTitle } from "#/components/ui/card";
import type { WorkspaceItem } from "#/components/workspace/types";
import { findItemForTab } from "#/lib/workspace-tabs";
import type { WorkspaceTab } from "#/stores/workspace-tabs";

interface WorkspaceContentProps {
	items: WorkspaceItem[];
	itemsById: Map<string, WorkspaceItem>;
	activeTab: WorkspaceTab;
	onOpenItem: (item: WorkspaceItem) => void;
}

export default function WorkspaceContent({
	items,
	itemsById,
	activeTab,
	onOpenItem,
}: WorkspaceContentProps) {
	if (activeTab.kind === "item") {
		const item = findItemForTab(activeTab, itemsById);

		return <WorkspaceItemView tab={activeTab} item={item} />;
	}

	return (
		<main className="px-4 py-4">
			<section className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
				{items.map((item) => (
					<WorkspaceItemCard
						key={item.id}
						item={item}
						onOpenItem={onOpenItem}
					/>
				))}
			</section>
		</main>
	);
}

function WorkspaceItemCard({
	item,
	onOpenItem,
}: {
	item: WorkspaceItem;
	onOpenItem: (item: WorkspaceItem) => void;
}) {
	const ItemIcon = item.icon;

	return (
		<Card className="gap-0 overflow-hidden py-0 transition-all hover:bg-accent hover:shadow-md dark:hover:bg-accent/60">
			<button
				type="button"
				className="flex w-full flex-col text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				onClick={() => onOpenItem(item)}
			>
				<div className="flex aspect-[5/2] items-center justify-center bg-muted">
					<ItemIcon
						className="size-10 text-muted-foreground"
						strokeWidth={1.75}
						aria-hidden="true"
					/>
				</div>
				<CardHeader className="gap-2 py-5">
					<CardTitle>{item.title}</CardTitle>
					<p className="text-xs text-muted-foreground">{item.meta}</p>
				</CardHeader>
			</button>
		</Card>
	);
}

function WorkspaceItemView({
	tab,
	item,
}: {
	tab: WorkspaceTab;
	item: WorkspaceItem | undefined;
}) {
	const ItemIcon = item?.icon ?? FileQuestion;

	return (
		<main className="px-4 py-4">
			<section className="space-y-4">
				<div className="flex items-center gap-2">
					<ItemIcon
						className="size-5 text-muted-foreground"
						strokeWidth={1.75}
						aria-hidden="true"
					/>
					<h1 className="truncate text-xl font-semibold tracking-tight">
						{tab.title}
					</h1>
				</div>
				<div className="flex min-h-64 items-center justify-center rounded-md border bg-background text-sm text-muted-foreground">
					{item ? "Item content placeholder" : "Item unavailable"}
				</div>
			</section>
		</main>
	);
}
