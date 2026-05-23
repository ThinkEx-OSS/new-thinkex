import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WorkspacePane =
	| { id: string; kind: "root" }
	| { id: string; kind: "item"; itemId: string }
	| { id: string; kind: "chat" };

export type WorkspacePresentation =
	| { mode: "standard" }
	| {
			mode: "split";
			direction: "horizontal" | "vertical";
			panes: [WorkspacePane, WorkspacePane];
			activePaneId: string;
	  }
	| {
			mode: "maximized";
			pane: WorkspacePane;
			restorePresentation: Exclude<
				WorkspacePresentation,
				{ mode: "maximized" }
			>;
	  };

type WorkspaceUiState = {
	chatPanelCollapsed: boolean;
	presentation: WorkspacePresentation;
	closeChatPanel: () => void;
	openChatPanel: () => void;
	toggleChatPanelCollapsed: () => void;
	maximizeChat: () => void;
	maximizeItem: (itemId: string) => void;
	restorePresentation: () => void;
	setSplitPresentation: (input: {
		direction: "horizontal" | "vertical";
		panes: [WorkspacePane, WorkspacePane];
		activePaneId: string;
	}) => void;
};

const standardPresentation: WorkspacePresentation = { mode: "standard" };
const chatPane: WorkspacePane = { id: "chat", kind: "chat" };

function getRestorablePresentation(presentation: WorkspacePresentation) {
	if (presentation.mode === "maximized") {
		return presentation.restorePresentation;
	}

	return presentation;
}

export const useWorkspaceUiStore = create<WorkspaceUiState>()(
	persist(
		(set) => ({
			chatPanelCollapsed: false,
			presentation: standardPresentation,
			closeChatPanel: () =>
				set((state) => ({
					chatPanelCollapsed: true,
					presentation:
						state.presentation.mode === "maximized" &&
						state.presentation.pane.kind === "chat"
							? state.presentation.restorePresentation
							: state.presentation,
				})),
			openChatPanel: () =>
				set((state) => ({
					chatPanelCollapsed: false,
					presentation: state.presentation,
				})),
			toggleChatPanelCollapsed: () =>
				set((state) => ({
					chatPanelCollapsed: !state.chatPanelCollapsed,
					presentation:
						state.presentation.mode === "maximized" &&
						state.presentation.pane.kind === "chat"
							? state.presentation.restorePresentation
							: state.presentation,
				})),
			maximizeChat: () =>
				set((state) => ({
					chatPanelCollapsed: false,
					presentation: {
						mode: "maximized",
						pane: chatPane,
						restorePresentation: getRestorablePresentation(state.presentation),
					},
				})),
			maximizeItem: (itemId) =>
				set((state) => ({
					presentation: {
						mode: "maximized",
						pane: { id: `item:${itemId}`, kind: "item", itemId },
						restorePresentation: getRestorablePresentation(state.presentation),
					},
				})),
			restorePresentation: () =>
				set((state) => ({
					presentation:
						state.presentation.mode === "maximized"
							? state.presentation.restorePresentation
							: standardPresentation,
				})),
			setSplitPresentation: ({ direction, panes, activePaneId }) =>
				set({
					presentation: {
						mode: "split",
						direction,
						panes,
						activePaneId,
					},
				}),
		}),
		{
			name: "thinkex.workspace-ui.v1",
			partialize: ({ chatPanelCollapsed, presentation }) => ({
				chatPanelCollapsed,
				presentation,
			}),
		},
	),
);
