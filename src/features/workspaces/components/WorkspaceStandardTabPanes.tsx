import WorkspaceContent from "#/features/workspaces/components/WorkspaceContent";
import { WorkspacePaneRuntimeProvider } from "#/features/workspaces/components/WorkspacePaneRuntime";
import type { WorkspaceItemType } from "#/features/workspaces/contracts";
import type { WorkspaceTab } from "#/features/workspaces/model/tab-types";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { cn } from "#/lib/utils";

export default function WorkspaceStandardTabPanes({
	activeTabId,
	itemsById,
	scopedItems,
	tabs,
	workspaceId,
	onAddItemsToAiContext,
	onCreateItem,
	onOpenItem,
}: {
	activeTabId: string;
	itemsById: Map<string, WorkspaceItem>;
	scopedItems: WorkspaceItem[];
	tabs: WorkspaceTab[];
	workspaceId: string;
	onAddItemsToAiContext: (items: WorkspaceItem[]) => void;
	onCreateItem: (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => void;
	onOpenItem: (item: WorkspaceItem, options?: { background?: boolean }) => void;
}) {
	return (
		<div className="relative h-full min-h-0 overflow-hidden">
			{tabs.map((tab) => {
				const isActive = tab.id === activeTabId;

				return (
					<div
						key={tab.id}
						aria-hidden={!isActive}
						className={cn(
							"absolute inset-0 min-h-0",
							isActive
								? "block pointer-events-auto"
								: "hidden pointer-events-none select-none",
						)}
						inert={isActive ? undefined : true}
					>
						<WorkspacePaneRuntimeProvider isActive={isActive}>
							<WorkspaceContent
								instanceId={tab.id}
								items={scopedItems}
								activeItem={
									tab.viewItemId ? itemsById.get(tab.viewItemId) : undefined
								}
								workspaceId={workspaceId}
								onAddItemsToAiContext={onAddItemsToAiContext}
								onCreateItem={onCreateItem}
								onOpenItem={onOpenItem}
							/>
						</WorkspacePaneRuntimeProvider>
					</div>
				);
			})}
		</div>
	);
}
