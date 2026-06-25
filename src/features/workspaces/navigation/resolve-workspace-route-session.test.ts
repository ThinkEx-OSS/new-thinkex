import { describe, expect, it } from "vitest";

import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { resolveWorkspaceRouteSession } from "#/features/workspaces/navigation/resolve-workspace-route-session";

const workspaceName = "Research";

describe("resolveWorkspaceRouteSession", () => {
	it("activates the requested tab from the existing session", () => {
		const rootTab = createTab({ id: "tab-root", title: workspaceName });
		const docTab = createTab({ id: "tab-doc", title: "Doc 1", viewItemId: "doc-1" });
		const item = createItem({ id: "doc-1", name: "Doc 1", title: "Doc 1", type: "document" });

		const result = resolveWorkspaceRouteSession({
			session: {
				activeTabId: rootTab.id,
				tabs: [rootTab, docTab],
			},
			workspaceName,
			itemsById: new Map([[item.id, item]]),
			validItemIds: new Set([item.id]),
			requestedTabId: docTab.id,
		});

		expect(result.resolvedActiveTab.id).toBe(docTab.id);
		expect(result.shouldActivateTab).toBe(true);
		expect(result.tabViewUpdate).toBeUndefined();
		expect(result.canonicalSearch).toEqual({
			tab: docTab.id,
			view: item.id,
		});
	});

	it("reuses the current tab when the requested tab is missing but view is valid", () => {
		const rootTab = createTab({ id: "tab-root", title: workspaceName });
		const item = createItem({ id: "doc-1", name: "Doc 1", title: "Doc 1", type: "document" });

		const result = resolveWorkspaceRouteSession({
			session: {
				activeTabId: rootTab.id,
				tabs: [rootTab],
			},
			workspaceName,
			itemsById: new Map([[item.id, item]]),
			validItemIds: new Set([item.id]),
			requestedTabId: "tab-missing",
			requestedView: item.id,
		});

		expect(result.resolvedActiveTab.id).toBe(rootTab.id);
		expect(result.shouldActivateTab).toBe(false);
		expect(result.tabViewUpdate).toEqual({
			title: item.name,
			viewItemId: item.id,
		});
		expect(result.canonicalSearch).toEqual({
			tab: rootTab.id,
			view: item.id,
		});
	});

	it("falls back to the normalized active tab when the URL is empty", () => {
		const docTab = createTab({ id: "tab-doc", title: "Doc 1", viewItemId: "doc-1" });
		const item = createItem({ id: "doc-1", name: "Doc 1", title: "Doc 1", type: "document" });

		const result = resolveWorkspaceRouteSession({
			session: {
				activeTabId: docTab.id,
				tabs: [docTab],
			},
			workspaceName,
			itemsById: new Map([[item.id, item]]),
			validItemIds: new Set([item.id]),
		});

		expect(result.resolvedActiveTab).toEqual(docTab);
		expect(result.shouldActivateTab).toBe(false);
		expect(result.tabViewUpdate).toBeUndefined();
		expect(result.canonicalSearch).toEqual({
			tab: docTab.id,
			view: item.id,
		});
	});
});

function createTab(input: { id: string; title: string; viewItemId?: string }) {
	return {
		id: input.id,
		title: input.title,
		viewItemId: input.viewItemId,
		createdAt: 1,
		updatedAt: 1,
	};
}

function createItem(input: {
	id: string;
	name: string;
	title: string;
	type: WorkspaceItem["type"];
}): WorkspaceItem {
	return {
		id: input.id,
		workspaceId: "workspace-1",
		parentId: null,
		type: input.type,
		title: input.title,
		name: input.name,
		meta: "",
		color: null,
		metadataJson: {},
		sortOrder: 0,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		deletedAt: null,
	};
}
