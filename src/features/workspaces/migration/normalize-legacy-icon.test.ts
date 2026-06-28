import { describe, expect, it } from "vitest";

import { normalizeLegacyIcon } from "#/features/workspaces/migration/normalize-legacy-icon.ts";

describe("normalizeLegacyIcon", () => {
	it("returns compass for null", () => {
		expect(normalizeLegacyIcon(null)).toBe("compass");
	});

	it("returns compass for empty string", () => {
		expect(normalizeLegacyIcon("")).toBe("compass");
	});

	it("passes through an exact icon value", () => {
		expect(normalizeLegacyIcon("book-open")).toBe("book-open");
		expect(normalizeLegacyIcon("flask-conical")).toBe("flask-conical");
	});

	it("strips lucide: prefix", () => {
		expect(normalizeLegacyIcon("lucide:book-open")).toBe("book-open");
	});

	it("converts PascalCase lucide icons", () => {
		expect(normalizeLegacyIcon("lucide:BookOpen")).toBe("book-open");
		expect(normalizeLegacyIcon("lucide:GraduationCap")).toBe("graduation-cap");
		expect(normalizeLegacyIcon("lucide:FlaskConical")).toBe("flask-conical");
	});

	it("converts PascalCase without prefix", () => {
		expect(normalizeLegacyIcon("ChartColumn")).toBe("chart-column");
		expect(normalizeLegacyIcon("FileText")).toBe("file-text");
	});

	it("maps AcademicCapIcon to graduation-cap", () => {
		expect(normalizeLegacyIcon("AcademicCapIcon")).toBe("graduation-cap");
	});

	it("maps BookOpenIcon to book-open", () => {
		expect(normalizeLegacyIcon("BookOpenIcon")).toBe("book-open");
	});

	it("maps DocumentTextIcon to file-text", () => {
		expect(normalizeLegacyIcon("DocumentTextIcon")).toBe("file-text");
	});

	it("maps CodeBracketIcon to code-2", () => {
		expect(normalizeLegacyIcon("CodeBracketIcon")).toBe("code-2");
	});

	it("maps ChartBarIcon to chart-column", () => {
		expect(normalizeLegacyIcon("ChartBarIcon")).toBe("chart-column");
	});

	it("maps ChartPieIcon to chart-pie", () => {
		expect(normalizeLegacyIcon("ChartPieIcon")).toBe("chart-pie");
	});

	it("maps ComputerDesktopIcon to cpu", () => {
		expect(normalizeLegacyIcon("ComputerDesktopIcon")).toBe("cpu");
	});

	it("maps GlobeAmericasIcon to globe-2", () => {
		expect(normalizeLegacyIcon("GlobeAmericasIcon")).toBe("globe-2");
	});

	it("maps BuildingLibraryIcon to landmark", () => {
		expect(normalizeLegacyIcon("BuildingLibraryIcon")).toBe("landmark");
	});

	it("maps BeakerIcon to flask-conical", () => {
		expect(normalizeLegacyIcon("BeakerIcon")).toBe("flask-conical");
	});

	it("maps MegaphoneIcon to megaphone", () => {
		expect(normalizeLegacyIcon("MegaphoneIcon")).toBe("megaphone");
	});

	it("maps CalculatorIcon to calculator", () => {
		expect(normalizeLegacyIcon("CalculatorIcon")).toBe("calculator");
	});

	it("maps BugAntIcon to atom", () => {
		expect(normalizeLegacyIcon("BugAntIcon")).toBe("atom");
	});

	it("returns compass for unknown icon names", () => {
		expect(normalizeLegacyIcon("SomeRandomIcon")).toBe("compass");
		expect(normalizeLegacyIcon("unknown-thing")).toBe("compass");
	});
});
