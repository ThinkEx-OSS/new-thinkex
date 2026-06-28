import { describe, expect, it } from "vitest";

import { deduplicateSiblingNames } from "#/features/workspaces/migration/deduplicate-sibling-names.ts";

describe("deduplicateSiblingNames", () => {
	it("returns items unchanged when no conflicts", () => {
		const items = [
			{ name: "Alpha", parentId: null },
			{ name: "Beta", parentId: null },
			{ name: "Gamma", parentId: "folder-1" },
		];

		const result = deduplicateSiblingNames(items);

		expect(result.map((r) => r.name)).toEqual(["Alpha", "Beta", "Gamma"]);
		expect(result.every((r) => !r.renamed)).toBe(true);
	});

	it("renames duplicate siblings at root with incrementing suffix", () => {
		const items = [
			{ name: "Document", parentId: null },
			{ name: "Document", parentId: null },
			{ name: "Document", parentId: null },
		];

		const result = deduplicateSiblingNames(items);

		expect(result[0]!.name).toBe("Document");
		expect(result[0]!.renamed).toBe(false);
		expect(result[1]!.name).toBe("Document 2");
		expect(result[1]!.renamed).toBe(true);
		expect(result[2]!.name).toBe("Document 3");
		expect(result[2]!.renamed).toBe(true);
	});

	it("allows same name in different parents", () => {
		const items = [
			{ name: "Notes", parentId: "folder-a" },
			{ name: "Notes", parentId: "folder-b" },
		];

		const result = deduplicateSiblingNames(items);

		expect(result[0]!.name).toBe("Notes");
		expect(result[1]!.name).toBe("Notes");
		expect(result.every((r) => !r.renamed)).toBe(true);
	});

	it("preserves originalName on renamed items", () => {
		const items = [
			{ name: "Doc", parentId: null },
			{ name: "Doc", parentId: null },
		];

		const result = deduplicateSiblingNames(items);

		expect(result[1]!.originalName).toBe("Doc");
		expect(result[1]!.name).toBe("Doc 2");
	});

	it("normalizes names through normalizeWorkspaceItemName", () => {
		const items = [
			{ name: "  extra  spaces  ", parentId: null },
			{ name: "extra spaces", parentId: null },
		];

		const result = deduplicateSiblingNames(items);

		expect(result[0]!.name).toBe("extra spaces");
		expect(result[1]!.renamed).toBe(true);
	});

	it("handles empty input", () => {
		expect(deduplicateSiblingNames([])).toEqual([]);
	});
});
