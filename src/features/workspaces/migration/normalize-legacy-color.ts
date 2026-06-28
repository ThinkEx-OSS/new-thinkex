import type { WorkspaceColor } from "#/features/workspaces/contracts";
import { workspaceColorValues } from "#/features/workspaces/contracts";

const DEFAULT_COLOR: WorkspaceColor = "sky";

interface HueBucket {
	hue: string;
	minHue: number;
	maxHue: number;
}

const hueBuckets: HueBucket[] = [
	{ hue: "red", minHue: 345, maxHue: 360 },
	{ hue: "red", minHue: 0, maxHue: 15 },
	{ hue: "orange", minHue: 15, maxHue: 35 },
	{ hue: "amber", minHue: 35, maxHue: 65 },
	{ hue: "emerald", minHue: 65, maxHue: 170 },
	{ hue: "teal", minHue: 170, maxHue: 195 },
	{ hue: "sky", minHue: 195, maxHue: 250 },
	{ hue: "violet", minHue: 250, maxHue: 310 },
	{ hue: "rose", minHue: 310, maxHue: 345 },
];

const paletteNameMap: Record<string, WorkspaceColor> = {};
for (const value of workspaceColorValues) {
	paletteNameMap[value] = value;
}

const namedColorHexMap: Record<string, string> = {
	red: "#ef4444",
	orange: "#f97316",
	amber: "#f59e0b",
	yellow: "#eab308",
	lime: "#84cc16",
	green: "#22c55e",
	emerald: "#10b981",
	teal: "#14b8a6",
	cyan: "#06b6d4",
	sky: "#0ea5e9",
	blue: "#3b82f6",
	indigo: "#6366f1",
	violet: "#8b5cf6",
	purple: "#a855f7",
	fuchsia: "#d946ef",
	pink: "#ec4899",
	rose: "#f43f5e",
	slate: "#64748b",
	gray: "#6b7280",
	grey: "#6b7280",
	zinc: "#71717a",
	neutral: "#737373",
	stone: "#78716c",
	black: "#000000",
	white: "#ffffff",
};

export function normalizeLegacyColor(legacyColor: string | null): WorkspaceColor {
	if (!legacyColor) {
		return DEFAULT_COLOR;
	}

	const trimmed = legacyColor.trim().toLowerCase();

	if (!trimmed) {
		return DEFAULT_COLOR;
	}

	if (paletteNameMap[trimmed]) {
		return paletteNameMap[trimmed]!;
	}

	const hex = trimmed.startsWith("#") ? trimmed : namedColorHexMap[trimmed];

	if (hex) {
		return hexToWorkspaceColor(hex);
	}

	return DEFAULT_COLOR;
}

function hexToWorkspaceColor(hex: string): WorkspaceColor {
	const rgb = parseHex(hex);

	if (!rgb) {
		return DEFAULT_COLOR;
	}

	const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

	if (s < 10) {
		return l >= 50 ? "sky-soft" : "sky-deep";
	}

	const hue = resolveHueBucket(h);
	const suffix = resolveLightnessSuffix(l);

	return `${hue}${suffix}` as WorkspaceColor;
}

function resolveHueBucket(hue: number): string {
	for (const bucket of hueBuckets) {
		if (hue >= bucket.minHue && hue < bucket.maxHue) {
			return bucket.hue;
		}
	}

	return "sky";
}

function resolveLightnessSuffix(lightness: number): string {
	if (lightness >= 70) {
		return "-soft";
	}

	if (lightness >= 50) {
		return "";
	}

	if (lightness >= 35) {
		return "-bold";
	}

	return "-deep";
}

function parseHex(hex: string): [number, number, number] | null {
	const cleaned = hex.replace(/^#/, "");

	let r: number;
	let g: number;
	let b: number;

	if (cleaned.length === 3) {
		r = parseInt(cleaned[0]! + cleaned[0]!, 16);
		g = parseInt(cleaned[1]! + cleaned[1]!, 16);
		b = parseInt(cleaned[2]! + cleaned[2]!, 16);
	} else if (cleaned.length === 6) {
		r = parseInt(cleaned.slice(0, 2), 16);
		g = parseInt(cleaned.slice(2, 4), 16);
		b = parseInt(cleaned.slice(4, 6), 16);
	} else {
		return null;
	}

	if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
		return null;
	}

	return [r, g, b];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;

	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;

	if (max === min) {
		return [0, 0, Math.round(l * 100)];
	}

	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

	let h: number;

	if (max === rn) {
		h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
	} else if (max === gn) {
		h = ((bn - rn) / d + 2) / 6;
	} else {
		h = ((rn - gn) / d + 4) / 6;
	}

	return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
