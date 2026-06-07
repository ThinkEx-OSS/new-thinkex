import type { ReactNode } from "react";

import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "#/components/ui/resizable";
import AiChatPanel from "#/features/workspaces/components/AiChatPanel";
import WorkspaceContent from "#/features/workspaces/components/WorkspaceContent";
import type { WorkspaceItemType } from "#/features/workspaces/contracts";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import type {
	WorkspacePane,
	WorkspacePresentation,
} from "#/features/workspaces/state/workspace-ui-store";

interface WorkspacePresentationProps {
	workspaceId: string;
	itemsById: Map<string, WorkspaceItem>;
	scopedItems: WorkspaceItem[];
	onCreateItem: (input: {
		type: WorkspaceItemType;
		parentId: string | null;
	}) => void;
	onOpenItem: (item: WorkspaceItem, options?: { background?: boolean }) => void;
}

interface WorkspacePaneRendererProps extends WorkspacePresentationProps {
	pane: WorkspacePane;
}

export function WorkspaceMaximizedPresentation({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<div className="h-screen overflow-hidden bg-background text-foreground">
			{children}
		</div>
	);
}

export function WorkspacePaneRenderer({
	workspaceId,
	pane,
	itemsById,
	scopedItems,
	onCreateItem,
	onOpenItem,
}: WorkspacePaneRendererProps) {
	switch (pane.kind) {
		case "chat":
			return <AiChatPanel workspaceId={workspaceId} />;
		case "item": {
			const item = itemsById.get(pane.itemId);

			return (
				<WorkspaceContent
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
					items={scopedItems}
					activeItem={undefined}
					onCreateItem={onCreateItem}
					onOpenItem={onOpenItem}
				/>
			);
	}
}

export function WorkspaceSplitPresentation({
	workspaceId,
	panes,
	direction,
	itemsById,
	scopedItems,
	onCreateItem,
	onOpenItem,
}: WorkspacePresentationProps & {
	panes: [WorkspacePane, WorkspacePane];
	direction: "horizontal" | "vertical";
}) {
	return (
		<ResizablePanelGroup
			id="workspace-split-presentation"
			orientation={direction}
			className="min-h-[calc(100vh-5.75rem)]"
		>
			<ResizablePanel id={panes[0].id} minSize="18rem">
				<WorkspacePaneRenderer
					workspaceId={workspaceId}
					pane={panes[0]}
					itemsById={itemsById}
					scopedItems={scopedItems}
					onCreateItem={onCreateItem}
					onOpenItem={onOpenItem}
				/>
			</ResizablePanel>
			<ResizableHandle withHandle={true} />
			<ResizablePanel id={panes[1].id} minSize="18rem">
				<WorkspacePaneRenderer
					workspaceId={workspaceId}
					pane={panes[1]}
					itemsById={itemsById}
					scopedItems={scopedItems}
					onCreateItem={onCreateItem}
					onOpenItem={onOpenItem}
				/>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
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
