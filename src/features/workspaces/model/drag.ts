export const WORKSPACE_TAB_DRAG_TYPE = "workspace-tab";

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
			side: "left" | "right" | "top" | "bottom";
	  }
	| {
			type: "move-tab-to-pane";
			tabId: string;
			targetPaneId: string;
	  };

export type WorkspaceDragEndEvent = {
	operation: {
		canceled?: boolean;
		source?: {
			id: unknown;
			type?: unknown;
			index?: unknown;
			initialIndex?: unknown;
		} | null;
		target?: { id: unknown; type?: unknown } | null;
	};
	canceled?: boolean;
};

export function getWorkspaceDragCommand(
	event: WorkspaceDragEndEvent,
): WorkspaceDragCommand | undefined {
	const { source, target } = event.operation;
	const canceled = event.canceled ?? event.operation.canceled;

	if (canceled || !source) {
		return undefined;
	}

	if (source.type !== WORKSPACE_TAB_DRAG_TYPE) {
		return undefined;
	}

	if (
		typeof source.index === "number" &&
		typeof source.initialIndex === "number" &&
		source.index !== source.initialIndex
	) {
		return {
			type: "move-tab-in-strip",
			tabId: String(source.id),
			toIndex: source.index,
		};
	}

	if (target?.type === WORKSPACE_TAB_DRAG_TYPE) {
		return {
			type: "reorder-tabs-over-tab",
			activeTabId: String(source.id),
			overTabId: String(target.id),
		};
	}

	return undefined;
}
