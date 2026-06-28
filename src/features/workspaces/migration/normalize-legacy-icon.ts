import type { WorkspaceIcon } from "#/features/workspaces/contracts";
import { workspaceIconValues } from "#/features/workspaces/contracts";

const DEFAULT_ICON: WorkspaceIcon = "compass";

const iconSet = new Set<string>(workspaceIconValues);

const heroiconsMap: Record<string, WorkspaceIcon> = {
	"academic-cap-icon": "graduation-cap",
	"academic-cap": "graduation-cap",
	"book-open-icon": "book-open",
	"document-text-icon": "file-text",
	"document-text": "file-text",
	"code-bracket-icon": "code-2",
	"code-bracket": "code-2",
	"chart-bar-icon": "chart-column",
	"chart-bar": "chart-column",
	"chart-pie-icon": "chart-pie",
	"computer-desktop-icon": "cpu",
	"computer-desktop": "cpu",
	"globe-americas-icon": "globe-2",
	"globe-americas": "globe-2",
	"globe-alt-icon": "globe-2",
	"globe-alt": "globe-2",
	"building-library-icon": "landmark",
	"building-library": "landmark",
	"beaker-icon": "flask-conical",
	beaker: "flask-conical",
	"megaphone-icon": "megaphone",
	"calculator-icon": "calculator",
	"bug-ant-icon": "atom",
	"bug-ant": "atom",
	"light-bulb-icon": "lightbulb",
	"light-bulb": "lightbulb",
	"pencil-icon": "notebook-pen",
	pencil: "notebook-pen",
	"folder-icon": "folder-open",
	"folder-open-icon": "folder-open",
	"document-icon": "file-text",
	"presentation-chart-bar-icon": "presentation",
	"presentation-chart-bar": "presentation",
	"musical-note-icon": "music",
	"musical-note": "music",
	"microphone-icon": "mic",
	microphone: "mic",
	"camera-icon": "camera",
	"video-camera-icon": "video",
	"video-camera": "video",
	"scale-icon": "scale",
	"users-icon": "users",
	"briefcase-icon": "briefcase-business",
	briefcase: "briefcase-business",
	"building-office-icon": "building-2",
	"building-office": "building-2",
	"newspaper-icon": "newspaper",
	"heart-icon": "heart-pulse",
	heart: "heart-pulse",
	"fire-icon": "flame",
	fire: "flame",
	"bolt-icon": "zap",
	bolt: "zap",
	"rocket-launch-icon": "rocket",
	"rocket-launch": "rocket",
	"star-icon": "target",
	star: "target",
	"map-icon": "map",
	"shield-check-icon": "shield-check",
	"shield-check": "shield-check",
	"wrench-icon": "wrench",
	"cog-icon": "wrench",
	cog: "wrench",
};

export function normalizeLegacyIcon(legacyIcon: string | null): WorkspaceIcon {
	if (!legacyIcon) {
		return DEFAULT_ICON;
	}

	const trimmed = legacyIcon.trim();

	if (!trimmed) {
		return DEFAULT_ICON;
	}

	const stripped = trimmed.replace(/^lucide:/, "");
	const kebab = pascalCaseToKebab(stripped);

	if (iconSet.has(kebab)) {
		return kebab as WorkspaceIcon;
	}

	const heroResult = heroiconsMap[kebab];

	if (heroResult) {
		return heroResult;
	}

	return DEFAULT_ICON;
}

function pascalCaseToKebab(value: string): string {
	if (value.includes("-") || value.includes("_")) {
		return value
			.replace(/_/g, "-")
			.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
			.toLowerCase();
	}

	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();
}
