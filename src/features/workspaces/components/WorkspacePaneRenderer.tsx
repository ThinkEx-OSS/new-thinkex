import AiChatPanel from "#/features/workspaces/components/AiChatPanel";
import WorkspaceContent from "#/features/workspaces/components/WorkspaceContent";
import type { WorkspacePaneRendererProps } from "#/features/workspaces/components/workspace-presentation-model";

export default function WorkspacePaneRenderer({
	aiContextScope,
	pane,
	scopedItems,
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
					onCreateItem={onCreateItem}
					onOpenItem={onOpenItem}
				/>
			);
	}
}
