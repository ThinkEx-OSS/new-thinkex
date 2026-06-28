import { describe, expect, it } from "vitest";

import {
	convertLegacyOcrPages,
	type LegacyOcrPage,
} from "#/features/workspaces/migration/legacy-ocr-pages.ts";

describe("convertLegacyOcrPages", () => {
	it("converts 0-based index to 1-based pageNumber", () => {
		const legacy: LegacyOcrPage[] = [
			{ index: 0, markdown: "Page one content" },
			{ index: 1, markdown: "Page two content" },
			{ index: 2, markdown: "Page three content" },
		];

		const result = convertLegacyOcrPages(legacy);

		expect(result).toEqual([
			{ pageNumber: 1, markdown: "Page one content" },
			{ pageNumber: 2, markdown: "Page two content" },
			{ pageNumber: 3, markdown: "Page three content" },
		]);
	});

	it("drops pages with empty markdown", () => {
		const legacy: LegacyOcrPage[] = [
			{ index: 0, markdown: "Content" },
			{ index: 1, markdown: "" },
			{ index: 2, markdown: "   " },
			{ index: 3, markdown: "More content" },
		];

		const result = convertLegacyOcrPages(legacy);

		expect(result).toHaveLength(2);
		expect(result[0]!.pageNumber).toBe(1);
		expect(result[1]!.pageNumber).toBe(4);
	});

	it("drops header, footer, tables, and hyperlinks", () => {
		const legacy: LegacyOcrPage[] = [
			{
				index: 0,
				markdown: "Main body",
				header: "Header text",
				footer: "Footer text",
				tables: [{ data: "table" }],
				hyperlinks: [{ url: "http://example.com" }],
			},
		];

		const result = convertLegacyOcrPages(legacy);

		expect(result).toEqual([{ pageNumber: 1, markdown: "Main body" }]);
	});

	it("returns empty array for empty input", () => {
		expect(convertLegacyOcrPages([])).toEqual([]);
	});

	it("trims whitespace from markdown", () => {
		const legacy: LegacyOcrPage[] = [{ index: 0, markdown: "  padded  " }];

		const result = convertLegacyOcrPages(legacy);

		expect(result).toEqual([{ pageNumber: 1, markdown: "padded" }]);
	});

	it("handles non-contiguous indices", () => {
		const legacy: LegacyOcrPage[] = [
			{ index: 0, markdown: "First" },
			{ index: 5, markdown: "Sixth" },
		];

		const result = convertLegacyOcrPages(legacy);

		expect(result).toEqual([
			{ pageNumber: 1, markdown: "First" },
			{ pageNumber: 6, markdown: "Sixth" },
		]);
	});

	it("drops pages with negative index", () => {
		const legacy: LegacyOcrPage[] = [
			{ index: -1, markdown: "Bad index" },
			{ index: 0, markdown: "Good" },
		];

		const result = convertLegacyOcrPages(legacy);

		expect(result).toEqual([{ pageNumber: 1, markdown: "Good" }]);
	});
});
