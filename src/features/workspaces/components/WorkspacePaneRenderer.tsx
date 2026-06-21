import WorkspaceContent from "#/features/workspaces/components/WorkspaceContent";
import type { WorkspacePaneRendererProps } from "#/features/workspaces/components/workspace-presentation-model";

export default function WorkspacePaneRenderer({
	aiContextScope,
	pane,
	scopedItems,
	workspace,
	onAddItemsToAiContext,
	onCreateItem,
	onOpenItem,
}: WorkspacePaneRendererProps) {
	switch (pane.kind) {
		case "item": {
			const item = aiContextScope.itemsById.get(pane.itemId);

			return (
				<WorkspaceContent
					workspace={workspace}
					items={scopedItems}
					activeItem={item}
					onAddItemsToAiContext={onAddItemsToAiContext}
					onCreateItem={onCreateItem}
					onOpenItem={onOpenItem}
				/>
			);
		}
		case "root":
			return (
				<WorkspaceContent
					workspace={workspace}
					items={scopedItems}
					activeItem={undefined}
					onAddItemsToAiContext={onAddItemsToAiContext}
					onCreateItem={onCreateItem}
					onOpenItem={onOpenItem}
				/>
			);
	}
}
