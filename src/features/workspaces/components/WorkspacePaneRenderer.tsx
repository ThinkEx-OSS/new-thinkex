import AiChatPanel from "#/features/workspaces/components/AiChatPanel";
import WorkspaceContent from "#/features/workspaces/components/WorkspaceContent";
import type { WorkspacePaneRendererProps } from "#/features/workspaces/components/workspace-presentation-model";

export default function WorkspacePaneRenderer({
	aiContextScope,
	pane,
	scopedItems,
	onAddItemsToAiContext,
	onCreateItem,
	onOpenItem,
}: WorkspacePaneRendererProps) {
	switch (pane.kind) {
		case "chat":
			return <AiChatPanel context={aiContextScope} />;
		case "item": {
			const item = aiContextScope.itemsById.get(pane.itemId);

			return (
				<WorkspaceContent
					workspaceId={aiContextScope.workspaceId}
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
					workspaceId={aiContextScope.workspaceId}
					items={scopedItems}
					activeItem={undefined}
					onAddItemsToAiContext={onAddItemsToAiContext}
					onCreateItem={onCreateItem}
					onOpenItem={onOpenItem}
				/>
			);
	}
}
