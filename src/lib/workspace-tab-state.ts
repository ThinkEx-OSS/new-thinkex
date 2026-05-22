import type {
	WorkspaceTab,
	WorkspaceTabSession,
} from "#/stores/workspace-tabs";

export function createTabId() {
	if (globalThis.crypto?.randomUUID) {
		return `tab-${globalThis.crypto.randomUUID()}`;
	}

	return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createRootWorkspaceTab(workspaceName: string): WorkspaceTab {
	const now = Date.now();

	return {
		id: createTabId(),
		kind: "root",
		title: workspaceName,
		createdAt: now,
		updatedAt: now,
	};
}

export function normalizeWorkspaceTabSession(
	session: WorkspaceTabSession | undefined,
	workspaceName: string,
): WorkspaceTabSession {
	if (!session || session.tabs.length === 0) {
		const rootTab = createRootWorkspaceTab(workspaceName);

		return {
			activeTabId: rootTab.id,
			tabs: [rootTab],
		};
	}

	if (session.tabs.some((tab) => tab.id === session.activeTabId)) {
		return session;
	}

	return {
		...session,
		activeTabId: session.tabs[0].id,
	};
}
