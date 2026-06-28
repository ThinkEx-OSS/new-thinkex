import { describe, expect, it } from "vitest";

import { convertLegacyDocument } from "#/features/workspaces/migration/legacy-document.ts";

describe("convertLegacyDocument", () => {
	it("converts textContent markdown to Tiptap JSON string", () => {
		const result = convertLegacyDocument({
			textContent: "# Hello World\n\nSome paragraph text.",
		});

		expect(result.content).toBeTruthy();
		const parsed = JSON.parse(result.content);
		expect(parsed.type).toBe("doc");
		expect(Array.isArray(parsed.content)).toBe(true);
	});

	it("prefers structuredData.markdown over textContent", () => {
		const result = convertLegacyDocument({
			textContent: "Fallback text",
			structuredData: { markdown: "# Preferred\n\nThis is preferred." },
		});

		const parsed = JSON.parse(result.content);
		expect(parsed.type).toBe("doc");
	});

	it("preserves sourceData in metadataJson.sources", () => {
		const sources = [{ url: "https://example.com", title: "Example" }];
		const result = convertLegacyDocument({
			textContent: "Some text",
			sourceData: sources,
		});

		expect(result.metadataJson.sources).toEqual(sources);
	});

	it("omits sources from metadataJson when sourceData is null", () => {
		const result = convertLegacyDocument({
			textContent: "Some text",
			sourceData: null,
		});

		expect(result.metadataJson).not.toHaveProperty("sources");
	});

	it("handles empty content gracefully", () => {
		const result = convertLegacyDocument({});

		const parsed = JSON.parse(result.content);
		expect(parsed.type).toBe("doc");
		expect(parsed.content).toBeTruthy();
	});

	it("content string ends with newline", () => {
		const result = convertLegacyDocument({
			textContent: "Hello",
		});

		expect(result.content.endsWith("\n")).toBe(true);
	});
});
