import { describe, expect, it } from "vitest";

import { normalizeLegacyColor } from "#/features/workspaces/migration/normalize-legacy-color.ts";

describe("normalizeLegacyColor", () => {
	it("returns sky for null", () => {
		expect(normalizeLegacyColor(null)).toBe("sky");
	});

	it("returns sky for empty string", () => {
		expect(normalizeLegacyColor("")).toBe("sky");
	});

	it("passes through an exact palette value", () => {
		expect(normalizeLegacyColor("emerald-bold")).toBe("emerald-bold");
		expect(normalizeLegacyColor("violet")).toBe("violet");
		expect(normalizeLegacyColor("red-deep")).toBe("red-deep");
	});

	it("converts #007bff (Bootstrap primary blue) to sky bucket", () => {
		const result = normalizeLegacyColor("#007bff");
		expect(result).toMatch(/^sky/);
	});

	it("converts #1f2937 (dark slate) to a deep variant", () => {
		const result = normalizeLegacyColor("#1f2937");
		expect(result).toMatch(/-deep$/);
	});

	it("converts #4CAF50 (Material green) to emerald bucket", () => {
		const result = normalizeLegacyColor("#4CAF50");
		expect(result).toMatch(/^emerald/);
	});

	it("converts #ef4444 (Tailwind red-500) to red", () => {
		const result = normalizeLegacyColor("#ef4444");
		expect(result).toMatch(/^red/);
	});

	it("converts #f59e0b (amber-500) to amber", () => {
		const result = normalizeLegacyColor("#f59e0b");
		expect(result).toMatch(/^amber/);
	});

	it("converts #f97316 (orange-500) to orange", () => {
		const result = normalizeLegacyColor("#f97316");
		expect(result).toMatch(/^orange/);
	});

	it("converts #8b5cf6 (violet-500) to violet", () => {
		const result = normalizeLegacyColor("#8b5cf6");
		expect(result).toMatch(/^violet/);
	});

	it("converts #f43f5e (rose-500) to red or rose", () => {
		const result = normalizeLegacyColor("#f43f5e");
		expect(result).toMatch(/^(red|rose)/);
	});

	it("handles named colors like 'blue'", () => {
		const result = normalizeLegacyColor("blue");
		expect(result).toMatch(/^sky|^violet/);
	});

	it("handles named colors like 'green'", () => {
		const result = normalizeLegacyColor("green");
		expect(result).toMatch(/^emerald/);
	});

	it("handles 3-char hex", () => {
		const result = normalizeLegacyColor("#f00");
		expect(result).toMatch(/^red/);
	});

	it("handles very light colors as -soft", () => {
		const result = normalizeLegacyColor("#ffcccc");
		expect(result).toMatch(/-soft$/);
	});

	it("handles achromatic black as deep", () => {
		const result = normalizeLegacyColor("#000000");
		expect(result).toBe("sky-deep");
	});

	it("handles achromatic white as soft", () => {
		const result = normalizeLegacyColor("#ffffff");
		expect(result).toBe("sky-soft");
	});

	it("returns sky for unrecognized strings", () => {
		expect(normalizeLegacyColor("some-garbage")).toBe("sky");
	});

	it("is case-insensitive for hex", () => {
		const upper = normalizeLegacyColor("#4CAF50");
		const lower = normalizeLegacyColor("#4caf50");
		expect(upper).toBe(lower);
	});
});
