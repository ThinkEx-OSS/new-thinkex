import { describe, expect, it } from "vitest";

import {
	resolveWorkspaceItemColor,
	resolveWorkspaceItemColorForCreate,
	workspaceItemSupportsCustomColor,
	workspaceItemTypeColors,
} from "#/features/workspaces/model/workspace-item-colors";

describe("workspaceItemTypeColors", () => {
	it("defines a color for every workspace item type", () => {
		expect(workspaceItemTypeColors).toEqual({
			document: "sky",
			file: "rose",
			flashcard: "violet",
			folder: "amber",
			quiz: "emerald",
		});
	});
});

describe("workspaceItemSupportsCustomColor", () => {
	it("allows custom colors only for folders", () => {
		expect(workspaceItemSupportsCustomColor("folder")).toBe(true);
		expect(workspaceItemSupportsCustomColor("document")).toBe(false);
		expect(workspaceItemSupportsCustomColor("file")).toBe(false);
		expect(workspaceItemSupportsCustomColor("flashcard")).toBe(false);
		expect(workspaceItemSupportsCustomColor("quiz")).toBe(false);
	});
});

describe("resolveWorkspaceItemColor", () => {
	it("uses the type color for non-folder items regardless of stored color", () => {
		expect(
			resolveWorkspaceItemColor({
				type: "document",
				color: "rose",
			}),
		).toBe("sky");
	});

	it("uses stored color for folders when valid", () => {
		expect(
			resolveWorkspaceItemColor({
				type: "folder",
				color: "teal",
			}),
		).toBe("teal");
	});

	it("falls back to the folder default when color is missing or invalid", () => {
		expect(
			resolveWorkspaceItemColor({
				type: "folder",
				color: null,
			}),
		).toBe("amber");

		expect(
			resolveWorkspaceItemColor({
				type: "folder",
				color: "not-a-color",
			}),
		).toBe("amber");
	});
});

describe("resolveWorkspaceItemColorForCreate", () => {
	it("assigns a random palette color when creating folders", () => {
		const color = resolveWorkspaceItemColorForCreate({ type: "folder" });

		expect(color).toBeTruthy();
	});

	it("stores null for non-folder items", () => {
		expect(
			resolveWorkspaceItemColorForCreate({
				type: "document",
				color: "rose",
			}),
		).toBeNull();
	});
});
