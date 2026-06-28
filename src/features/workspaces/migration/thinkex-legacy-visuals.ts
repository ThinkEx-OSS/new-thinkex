import type { WorkspaceColor, WorkspaceIcon } from "#/features/workspaces/contracts";
import { workspaceColorSchema, workspaceIconSchema } from "#/features/workspaces/contracts";

type Rgb = { b: number; g: number; r: number };

const legacyIconAliases: Record<string, WorkspaceIcon> = {
	academiccap: "graduation-cap",
	adjustmentshorizontal: "wrench",
	barchart2: "chart-column",
	book: "book-open",
	bookmark: "book-marked",
	calculator: "calculator",
	calendar: "calendar-days",
	chartbar: "chart-column",
	chartbarbig: "chart-column",
	chartline: "chart-line",
	chartpie: "chart-pie",
	code: "code-2",
	codebracket: "code-2",
	computerdesktop: "cpu",
	documenttext: "file-text",
	file: "file-text",
	filetext: "file-text",
	folder: "folder-open",
	globe: "globe-2",
	graduationcap: "graduation-cap",
	heart: "heart-pulse",
	inbox: "archive",
	library: "library-big",
	monitor: "cpu",
	notebook: "notebook-pen",
	notebooktext: "notebook-pen",
	notepadtext: "notebook-pen",
	paintbrush: "palette",
	paintbucket: "palette",
	piechart: "chart-pie",
	plus: "compass",
	search: "search-check",
	settings: "wrench",
	sparkles: "lightbulb",
	squarepen: "pen-tool",
	table: "chart-column",
	university: "school",
	user: "users",
	wallet: "wallet-cards",
};

export function normalizeThinkexLegacyWorkspaceColor(value: string | null | undefined) {
	if (!value) {
		return null;
	}

	const parsed = workspaceColorSchema.safeParse(value);
	if (parsed.success) {
		return parsed.data;
	}

	const rgb = parseHexColor(value);
	if (!rgb) {
		return null;
	}

	return mapRgbToWorkspaceColor(rgb);
}

export function normalizeThinkexLegacyWorkspaceIcon(value: string | null | undefined) {
	if (!value) {
		return null;
	}

	const parsed = workspaceIconSchema.safeParse(value);
	if (parsed.success) {
		return parsed.data;
	}

	const normalizedKey = normalizeLegacyIconKey(value);
	const kebabValue = value
		.trim()
		.replace(/^lucide:/i, "")
		.replace(/Icon$/i, "")
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
		.replace(/[^a-z0-9]+/gi, "-")
		.toLowerCase();
	const kebabParsed = workspaceIconSchema.safeParse(kebabValue);
	if (kebabParsed.success) {
		return kebabParsed.data;
	}

	return legacyIconAliases[normalizedKey] ?? null;
}

function parseHexColor(value: string): Rgb | null {
	const match = value.trim().match(/^#?([a-f\d]{6})$/i);
	if (!match) {
		return null;
	}

	const hex = match[1];

	return {
		r: Number.parseInt(hex.slice(0, 2), 16),
		g: Number.parseInt(hex.slice(2, 4), 16),
		b: Number.parseInt(hex.slice(4, 6), 16),
	};
}

function mapRgbToWorkspaceColor(rgb: Rgb): WorkspaceColor {
	const { h, l, s } = rgbToHsl(rgb);
	const tone = l >= 0.72 ? "soft" : l <= 0.35 ? "deep" : s >= 0.65 ? "bold" : null;
	const family = getWorkspaceColorFamily(h);

	return tone ? `${family}-${tone}` : family;
}

function getWorkspaceColorFamily(hue: number) {
	if (hue < 12 || hue >= 345) return "red";
	if (hue < 37) return "orange";
	if (hue < 75) return "amber";
	if (hue < 155) return "emerald";
	if (hue < 185) return "teal";
	if (hue < 250) return "sky";
	if (hue < 310) return "violet";
	return "rose";
}

function rgbToHsl({ r, g, b }: Rgb) {
	const red = r / 255;
	const green = g / 255;
	const blue = b / 255;
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const l = (max + min) / 2;

	if (max === min) {
		return { h: 200, l, s: 0 };
	}

	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;

	switch (max) {
		case red:
			h = (green - blue) / d + (green < blue ? 6 : 0);
			break;
		case green:
			h = (blue - red) / d + 2;
			break;
		default:
			h = (red - green) / d + 4;
	}

	return { h: h * 60, l, s };
}

function normalizeLegacyIconKey(value: string) {
	return value
		.trim()
		.replace(/^lucide:/i, "")
		.replace(/Icon$/i, "")
		.replace(/[^a-z0-9]/gi, "")
		.toLowerCase();
}
