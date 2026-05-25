import type {
	MoveWorkspaceItemInput,
	ReorderWorkspaceItemsInput,
} from "#/features/workspaces/contracts";
import type { WorkspaceItem } from "#/features/workspaces/model/types";

export const WORKSPACE_TAB_DRAG_TYPE = "workspace-tab";
export const WORKSPACE_FOLDER_DRAG_TYPE = "workspace-folder";
export const WORKSPACE_ITEM_DRAG_TYPE = "workspace-item";
export const WORKSPACE_ITEM_DRAG_TYPES = [
	WORKSPACE_FOLDER_DRAG_TYPE,
	WORKSPACE_ITEM_DRAG_TYPE,
];
export const WORKSPACE_OPENABLE_DRAG_TYPES = [
	WORKSPACE_TAB_DRAG_TYPE,
	WORKSPACE_FOLDER_DRAG_TYPE,
	WORKSPACE_ITEM_DRAG_TYPE,
];
export const WORKSPACE_TAB_ITEM_INSERT_DROP_TYPE =
	"workspace-tab-item-insert-drop-target";
export const WORKSPACE_SPLIT_DROP_TYPE = "workspace-split-drop-target";
export const WORKSPACE_CHAT_CONTEXT_DROP_TYPE =
	"workspace-chat-context-drop-target";

export type WorkspaceDragRow = "folder" | "item";
export type WorkspaceSplitDropSide = "left" | "right" | "top" | "bottom";

export type WorkspaceDragSource =
	| {
			kind: "tab";
			tabId: string;
	  }
	| {
			kind: "workspace-item";
			itemId: string;
			parentId?: string | null;
			row: WorkspaceDragRow;
	  };

export type WorkspaceDropTarget =
	| {
			kind: "tab";
			tabId: string;
	  }
	| {
			kind: "tab-strip-insert";
			insertIndex: number;
	  }
	| {
			kind: "workspace-folder";
			folderId: string;
			parentId?: string | null;
	  }
	| {
			kind: "workspace-item";
			itemId: string;
			parentId?: string | null;
			row: WorkspaceDragRow;
	  }
	| {
			kind: "pane-split";
			paneId: string;
			side: WorkspaceSplitDropSide;
	  }
	| {
			kind: "chat-context";
			workspaceId: string;
	  };

export type WorkspaceDragData =
	| {
			kind: "workspace-tab";
			tabId: string;
	  }
	| {
			kind: "workspace-item";
			itemId: string;
			parentId: string | null;
			row: WorkspaceDragRow;
	  };

export type WorkspaceDropTargetData =
	| {
			kind: "workspace-folder-drop-target";
			folderId: string;
			parentId: string | null;
	  }
	| {
			kind: "workspace-tab-item-insert-drop-target";
			index: number;
	  }
	| {
			kind: "workspace-pane-split-drop-target";
			paneId: string;
			side: WorkspaceSplitDropSide;
	  }
	| {
			kind: "workspace-chat-context-drop-target";
			workspaceId: string;
	  };

export type WorkspaceDragCommand =
	| {
			type: "reorder-tabs-over-tab";
			activeTabId: string;
			overTabId: string;
	  }
	| {
			type: "move-tab-in-strip";
			tabId: string;
			toIndex: number;
	  }
	| {
			type: "split-tab";
			tabId: string;
			targetPaneId: string;
			side: WorkspaceSplitDropSide;
	  }
	| {
			type: "move-tab-to-pane";
			tabId: string;
			targetPaneId: string;
	  };

export type WorkspaceDragEndEvent = {
	operation: {
		canceled?: boolean;
		source?: WorkspaceDragEntity | null;
		target?: WorkspaceDragEntity | null;
	};
	canceled?: boolean;
	preventDefault?: () => void;
};

export type WorkspaceDragEntity = {
	id?: unknown;
	type?: unknown;
	data?: unknown;
	index?: unknown;
	initialIndex?: unknown;
	group?: unknown;
	initialGroup?: unknown;
};

export type WorkspaceDragIntent =
	| {
			kind: "move-tab-in-strip";
			tabId: string;
			toIndex: number;
	  }
	| {
			kind: "reorder-tabs-over-tab";
			activeTabId: string;
			overTabId: string;
	  }
	| {
			kind: "open-item-tab";
			item: WorkspaceItem;
			insertIndex: number;
	  }
	| {
			kind: "move-item";
			resolution: Extract<WorkspaceItemMoveResolution, { kind: "move" }>;
	  }
	| {
			kind: "move-item-blocked";
			resolution: Extract<WorkspaceItemMoveResolution, { kind: "blocked" }>;
	  }
	| {
			kind: "reorder-item";
			orderScopeKey: string;
			mutationInput: ReorderWorkspaceItemsInput;
	  };

export type WorkspaceItemMoveResolution =
	| {
			kind: "move";
			sourceOrderScopeKey: string;
			mutationInput: MoveWorkspaceItemInput;
	  }
	| {
			kind: "blocked";
			reason:
				| "canceled"
				| "missing-source"
				| "missing-target-folder"
				| "self"
				| "same-parent"
				| "descendant";
			sourceId?: unknown;
			targetFolderId?: string;
	  };
