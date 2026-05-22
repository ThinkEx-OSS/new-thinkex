import {
	BookMarked,
	Compass,
	FlaskConical,
	type LucideIcon,
	Zap,
} from "lucide-react";

import type { WorkspaceAccent, WorkspaceSummary } from "#/lib/api/contracts";

const workspaceIcons: Record<WorkspaceSummary["icon"], LucideIcon> = {
	compass: Compass,
	"flask-conical": FlaskConical,
	zap: Zap,
	"book-marked": BookMarked,
};

const workspaceAccents: Record<WorkspaceAccent, { bg: string; text: string }> =
	{
		sky: { bg: "bg-sky-500/20", text: "text-sky-600 dark:text-sky-400" },
		violet: {
			bg: "bg-violet-500/20",
			text: "text-violet-600 dark:text-violet-400",
		},
		amber: {
			bg: "bg-amber-500/20",
			text: "text-amber-600 dark:text-amber-400",
		},
		emerald: {
			bg: "bg-emerald-500/20",
			text: "text-emerald-600 dark:text-emerald-400",
		},
	};

export function getWorkspaceDisplay(workspace: WorkspaceSummary) {
	return {
		Icon: workspaceIcons[workspace.icon],
		accent: workspaceAccents[workspace.accent],
	};
}
