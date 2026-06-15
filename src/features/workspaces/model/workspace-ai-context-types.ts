import type { WorkspaceTab } from "#/features/workspaces/model/tab-types";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import type { WorkspacePresentation } from "#/features/workspaces/state/workspace-ui-store";

export type WorkspaceAiContextScope = {
	activeItem?: WorkspaceItem;
	activeTabId?: string;
	aiContextItemIds: string[];
	itemsById: ReadonlyMap<string, WorkspaceItem>;
	presentation: WorkspacePresentation;
	tabs: WorkspaceTab[];
	workspaceId: string;
	workspaceName: string;
};

export type WorkspaceAiContextSnapshot = {
	workspace: {
		name: string;
	};
	view: {
		activeItem?: WorkspaceAiContextItemReference;
		activeTab?: WorkspaceAiContextTabReference;
		presentation: WorkspaceAiContextPresentationReference;
	};
	markedItems: WorkspaceAiContextMarkedItem[];
	openTabs: WorkspaceAiContextTabReference[];
	contentIncluded: false;
};

export type WorkspaceAiContextMarkedItem = WorkspaceAiContextItemReference & {
	availableToAi: true;
	markedForAiContext: true;
	order: number;
};

export type WorkspaceAiContextItemReference = {
	name: string;
	path: string;
	type: string;
	state: {
		activeVisible: boolean;
		openInTabs: string[];
	};
};

export type WorkspaceAiContextTabReference = {
	title: string;
	active: boolean;
	view:
		| { kind: "workspace-root" }
		| {
				kind: "workspace-item";
				item: WorkspaceAiContextItemReference;
		  }
		| { kind: "missing-item" };
};

export type WorkspaceAiContextPresentationReference =
	| { mode: "standard"; activePane?: WorkspaceAiContextPaneReference }
	| {
			mode: "split";
			direction: "horizontal" | "vertical";
			activePane?: WorkspaceAiContextPaneReference;
			panes: WorkspaceAiContextPaneReference[];
	  }
	| {
			mode: "maximized";
			activePane: WorkspaceAiContextPaneReference;
			restoreMode: "standard" | "split";
	  };

export type WorkspaceAiContextPaneReference =
	| { kind: "workspace-root" }
	| { kind: "ai-chat" }
	| {
			kind: "workspace-item";
			item: WorkspaceAiContextItemReference;
	  }
	| { kind: "missing-item" };

export type WorkspaceAiContextChip = {
	id: string;
	item: WorkspaceItem;
	isActiveVisible: boolean;
	label: string;
	path: string;
};
