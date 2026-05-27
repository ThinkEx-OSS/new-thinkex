import type { WorkspaceDragProjection } from "#/features/workspaces/model/drag-projection";
import type { WorkspaceTab } from "#/features/workspaces/state/workspace-tabs-store";

const TAB_MAX_WIDTH = "16rem";
const WORKSPACE_TAB_GAP_WIDTH = "0.25rem";
const WORKSPACE_PROJECTED_TAB_KEY_PREFIX = "projected-tab:";

export const WORKSPACE_TAB_ITEM_CLASS = "flex min-w-0 items-center gap-1";

export type WorkspaceTabInsertProjection = Extract<
	WorkspaceDragProjection,
	{ kind: "tab-insert" }
>;

export type WorkspaceTabRenderItem =
	| {
			kind: "tab";
			tab: WorkspaceTab;
			tabIndex: number;
	  }
	| {
			kind: "projected-tab";
			projection: WorkspaceTabInsertProjection;
	  };

export function getWorkspaceTabRenderItems(input: {
	tabs: WorkspaceTab[];
	projection?: WorkspaceTabInsertProjection;
}): WorkspaceTabRenderItem[] {
	const renderItems: WorkspaceTabRenderItem[] = input.tabs.map(
		(tab, tabIndex) => ({
			kind: "tab",
			tab,
			tabIndex,
		}),
	);

	if (!input.projection) {
		return renderItems;
	}

	const insertIndex = Math.max(
		0,
		Math.min(input.projection.insertIndex, renderItems.length),
	);
	const projection =
		insertIndex === input.projection.insertIndex
			? input.projection
			: { ...input.projection, insertIndex };
	const next = renderItems.slice();

	next.splice(insertIndex, 0, {
		kind: "projected-tab",
		projection,
	});

	return next;
}

export function isWorkspaceTabRenderItemActive(
	renderItem: WorkspaceTabRenderItem | undefined,
	activeTabId: string,
) {
	return renderItem?.kind === "tab" && renderItem.tab.id === activeTabId;
}

export function getWorkspaceTabRenderItemKey(
	renderItem: WorkspaceTabRenderItem,
) {
	return renderItem.kind === "projected-tab"
		? `${WORKSPACE_PROJECTED_TAB_KEY_PREFIX}${renderItem.projection.source.itemId}`
		: `tab:${renderItem.tab.id}`;
}

export function getWorkspaceTabGridStyle(input: {
	tabCount: number;
	lockedTabWidth: number | null;
}) {
	const normalMaxWidth = `calc(${input.tabCount} * ${TAB_MAX_WIDTH})`;

	if (!input.lockedTabWidth) {
		return {
			gridTemplateColumns: `repeat(${input.tabCount}, minmax(0, 1fr))`,
			width: "100%",
			maxWidth: normalMaxWidth,
		};
	}

	const gapCount = Math.max(input.tabCount - 1, 0);
	const lockedWidth = `calc(${input.tabCount} * ${input.lockedTabWidth}px + ${gapCount} * ${WORKSPACE_TAB_GAP_WIDTH})`;

	return {
		gridTemplateColumns: `repeat(${input.tabCount}, minmax(0, ${input.lockedTabWidth}px))`,
		width: lockedWidth,
		maxWidth: lockedWidth,
	};
}
