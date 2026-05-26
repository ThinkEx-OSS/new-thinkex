import {
	getWorkspaceDragSource,
	getWorkspaceDropTarget,
	getWorkspaceItemTabInsertMatch,
	type WorkspaceDragEntity,
	type WorkspaceDragSource,
	type WorkspaceSplitDropSide,
} from "#/features/workspaces/model/drag";
import type { WorkspaceItem } from "#/features/workspaces/model/types";

export type WorkspaceDragProjection =
	| {
			kind: "tab-insert";
			item: WorkspaceItem;
			source: Extract<WorkspaceDragSource, { kind: "workspace-item" }>;
			insertIndex: number;
	  }
	| {
			kind: "pane-split";
			source: WorkspaceDragSource;
			paneId: string;
			side: WorkspaceSplitDropSide;
	  }
	| {
			kind: "ai-context";
			item: WorkspaceItem;
			source: Extract<WorkspaceDragSource, { kind: "workspace-item" }>;
			workspaceId: string;
	  };

export function getWorkspaceDragProjection(input: {
	source: WorkspaceDragEntity | null | undefined;
	target: WorkspaceDragEntity | null | undefined;
	itemsById: ReadonlyMap<string, WorkspaceItem>;
}): WorkspaceDragProjection | undefined {
	const tabInsertMatch = getWorkspaceItemTabInsertMatch(input);

	if (tabInsertMatch) {
		const item = input.itemsById.get(tabInsertMatch.source.itemId);

		if (!item) {
			return undefined;
		}

		return {
			kind: "tab-insert",
			item,
			source: tabInsertMatch.source,
			insertIndex: tabInsertMatch.insertIndex,
		};
	}

	const source = getWorkspaceDragSource(input.source);
	const target = getWorkspaceDropTarget(input.target);

	if (!source || !target) {
		return undefined;
	}

	// Future pane/AI-context previews should stay declarative here; drag-end commit behavior belongs in drag-intent/navigation.
	if (target.kind === "pane-split") {
		return {
			kind: "pane-split",
			source,
			paneId: target.paneId,
			side: target.side,
		};
	}

	if (source.kind === "workspace-item" && target.kind === "ai-context") {
		const item = input.itemsById.get(source.itemId);

		if (!item) {
			return undefined;
		}

		return {
			kind: "ai-context",
			item,
			source,
			workspaceId: target.workspaceId,
		};
	}

	return undefined;
}
