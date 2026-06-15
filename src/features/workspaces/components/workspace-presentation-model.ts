import type { WorkspaceItemType } from "#/features/workspaces/contracts";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import type { WorkspaceAiContextScope } from "#/features/workspaces/model/workspace-ai-context";
import type {
	WorkspacePane,
	WorkspacePresentation,
} from "#/features/workspaces/state/workspace-ui-store";

export interface WorkspacePresentationProps {
	aiContextScope: WorkspaceAiContextScope;
	scopedItems: WorkspaceItem[];
	onCreateItem: (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => void;
	onAddItemsToAiContext: (items: WorkspaceItem[]) => void;
	onOpenItem: (item: WorkspaceItem, options?: { background?: boolean }) => void;
}

export interface WorkspacePaneRendererProps extends WorkspacePresentationProps {
	pane: WorkspacePane;
}

export function hasWorkspacePaneKind(
	presentation: WorkspacePresentation,
	kind: WorkspacePane["kind"],
) {
	if (presentation.mode === "standard") {
		return false;
	}

	if (presentation.mode === "maximized") {
		return presentation.pane.kind === kind;
	}

	return presentation.panes.some((pane) => pane.kind === kind);
}
