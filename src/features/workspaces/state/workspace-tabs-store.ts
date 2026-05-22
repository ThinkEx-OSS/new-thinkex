import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
	createRootWorkspaceTab,
	normalizeWorkspaceTabSession,
} from "#/features/workspaces/model/tab-state";

export type WorkspaceTab = {
	id: string;
	title: string;
	viewItemId?: string;
	createdAt: number;
	updatedAt: number;
};

export type WorkspaceTabSession = {
	activeTabId: string;
	tabs: WorkspaceTab[];
};

type EnsureWorkspaceSessionInput = {
	workspaceId: string;
	workspaceName: string;
	requestedTabId?: string;
	validItemIds?: ReadonlySet<string>;
};

type WorkspaceTabsState = {
	sessionsByWorkspaceId: Record<string, WorkspaceTabSession>;
	ensureWorkspaceSession: (
		input: EnsureWorkspaceSessionInput,
	) => WorkspaceTabSession;
	createRootTab: (input: {
		workspaceId: string;
		workspaceName: string;
	}) => WorkspaceTab;
	replaceTabView: (input: {
		workspaceId: string;
		tabId: string;
		title: string;
		viewItemId?: string;
	}) => WorkspaceTab;
	activateTab: (input: { workspaceId: string; tabId: string }) => void;
	closeTab: (input: {
		workspaceId: string;
		tabId: string;
	}) => WorkspaceTabSession;
	getSession: (workspaceId: string) => WorkspaceTabSession | undefined;
};

export const useWorkspaceTabsStore = create<WorkspaceTabsState>()(
	persist(
		(set, get) => ({
			sessionsByWorkspaceId: {},
			ensureWorkspaceSession: ({
				workspaceId,
				workspaceName,
				requestedTabId,
				validItemIds,
			}) => {
				const currentSession = get().sessionsByWorkspaceId[workspaceId];
				const normalizedSession = normalizeWorkspaceTabSession(
					currentSession,
					workspaceName,
					validItemIds,
				);
				const requestedTabExists =
					requestedTabId &&
					normalizedSession.tabs.some((tab) => tab.id === requestedTabId);
				const nextSession = requestedTabExists
					? { ...normalizedSession, activeTabId: requestedTabId }
					: normalizedSession;

				set((state) => ({
					sessionsByWorkspaceId: {
						...state.sessionsByWorkspaceId,
						[workspaceId]: nextSession,
					},
				}));

				return nextSession;
			},
			createRootTab: ({ workspaceId, workspaceName }) => {
				const rootTab = createRootWorkspaceTab(workspaceName);

				set((state) => {
					const session = normalizeWorkspaceTabSession(
						state.sessionsByWorkspaceId[workspaceId],
						workspaceName,
					);
					const nextSession = {
						activeTabId: rootTab.id,
						tabs: [...session.tabs, rootTab],
					};

					return {
						sessionsByWorkspaceId: {
							...state.sessionsByWorkspaceId,
							[workspaceId]: nextSession,
						},
					};
				});

				return rootTab;
			},
			replaceTabView: ({ workspaceId, tabId, title, viewItemId }) => {
				const now = Date.now();
				let updatedTab: WorkspaceTab | undefined;

				set((state) => {
					const session = state.sessionsByWorkspaceId[workspaceId];

					if (!session) {
						return state;
					}

					const nextTabs = session.tabs.map((tab) => {
						if (tab.id !== tabId) {
							return tab;
						}

						updatedTab = {
							id: tab.id,
							title,
							viewItemId,
							createdAt: tab.createdAt,
							updatedAt: now,
						};

						return updatedTab;
					});

					return {
						sessionsByWorkspaceId: {
							...state.sessionsByWorkspaceId,
							[workspaceId]: {
								activeTabId: tabId,
								tabs: nextTabs,
							},
						},
					};
				});

				if (!updatedTab) {
					throw new Error(`Unable to replace missing tab view: ${tabId}`);
				}

				return updatedTab;
			},
			activateTab: ({ workspaceId, tabId }) => {
				set((state) => {
					const session = state.sessionsByWorkspaceId[workspaceId];

					if (!session || !session.tabs.some((tab) => tab.id === tabId)) {
						return state;
					}

					return {
						sessionsByWorkspaceId: {
							...state.sessionsByWorkspaceId,
							[workspaceId]: {
								...session,
								activeTabId: tabId,
							},
						},
					};
				});
			},
			closeTab: ({ workspaceId, tabId }) => {
				const session = get().sessionsByWorkspaceId[workspaceId];

				if (!session || session.tabs.length <= 1) {
					return (
						session ?? {
							activeTabId: "",
							tabs: [],
						}
					);
				}

				const closedIndex = session.tabs.findIndex((tab) => tab.id === tabId);

				if (closedIndex === -1) {
					return session;
				}

				const nextTabs = session.tabs.filter((tab) => tab.id !== tabId);
				const nextActiveTabId =
					session.activeTabId === tabId
						? nextTabs[Math.max(0, closedIndex - 1)].id
						: session.activeTabId;
				const nextSession = {
					activeTabId: nextActiveTabId,
					tabs: nextTabs,
				};

				set((state) => ({
					sessionsByWorkspaceId: {
						...state.sessionsByWorkspaceId,
						[workspaceId]: nextSession,
					},
				}));

				return nextSession;
			},
			getSession: (workspaceId) => get().sessionsByWorkspaceId[workspaceId],
		}),
		{
			name: "thinkex.workspace-tabs.v2",
			partialize: (state) => ({
				sessionsByWorkspaceId: state.sessionsByWorkspaceId,
			}),
		},
	),
);
