import { create } from "zustand";
import { persist } from "zustand/middleware";

type AiChatPanelState = {
	isCollapsed: boolean;
	isMaximized: boolean;
	setCollapsed: (isCollapsed: boolean) => void;
	setMaximized: (isMaximized: boolean) => void;
	open: () => void;
	toggleCollapsed: () => void;
	toggleMaximized: () => void;
};

export const useAiChatPanelStore = create<AiChatPanelState>()(
	persist(
		(set) => ({
			isCollapsed: false,
			isMaximized: false,
			setCollapsed: (isCollapsed) =>
				set((state) => ({
					...state,
					isCollapsed,
					isMaximized: isCollapsed ? false : state.isMaximized,
				})),
			setMaximized: (isMaximized) =>
				set((state) => ({
					...state,
					isMaximized,
					isCollapsed: isMaximized ? false : state.isCollapsed,
				})),
			open: () => set({ isCollapsed: false, isMaximized: false }),
			toggleCollapsed: () =>
				set((state) => ({
					isCollapsed: !state.isCollapsed,
					isMaximized: false,
				})),
			toggleMaximized: () =>
				set((state) => ({
					isMaximized: !state.isMaximized,
					isCollapsed: false,
				})),
		}),
		{
			name: "thinkex.ai-chat-panel.v1",
			partialize: ({ isCollapsed, isMaximized }) => ({
				isCollapsed,
				isMaximized,
			}),
		},
	),
);
