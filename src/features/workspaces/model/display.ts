import {
	BookMarked,
	Compass,
	FlaskConical,
	type LucideIcon,
	Zap,
} from "lucide-react";

import type {
	WorkspaceColor,
	WorkspaceIcon,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";

const workspaceIcons: Record<WorkspaceIcon, LucideIcon> = {
	compass: Compass,
	"flask-conical": FlaskConical,
	zap: Zap,
	"book-marked": BookMarked,
};

const workspaceColors: Record<WorkspaceColor, { bg: string; text: string }> = {
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
const workspaceRecencyTimeFormatter = new Intl.DateTimeFormat(undefined, {
	hour: "numeric",
	minute: "2-digit",
});
const workspaceRecencyDateFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
});
const workspaceRecencyDateWithYearFormatter = new Intl.DateTimeFormat(
	undefined,
	{
		month: "short",
		day: "numeric",
		year: "numeric",
	},
);

export const workspaceIconOptions = [
	{ value: "compass", label: "Compass", Icon: Compass },
	{ value: "flask-conical", label: "Lab", Icon: FlaskConical },
	{ value: "zap", label: "Energy", Icon: Zap },
	{ value: "book-marked", label: "Study", Icon: BookMarked },
] as const satisfies ReadonlyArray<{
	value: WorkspaceIcon;
	label: string;
	Icon: LucideIcon;
}>;

export const workspaceColorOptions = [
	{ value: "sky", label: "Sky", ...workspaceColors.sky },
	{ value: "violet", label: "Violet", ...workspaceColors.violet },
	{ value: "amber", label: "Amber", ...workspaceColors.amber },
	{ value: "emerald", label: "Emerald", ...workspaceColors.emerald },
] as const satisfies ReadonlyArray<{
	value: WorkspaceColor;
	label: string;
	bg: string;
	text: string;
}>;

export function getWorkspaceDisplay(workspace: WorkspaceSummary) {
	const icon = workspace.icon ?? "compass";
	const color = workspace.color ?? "sky";

	return {
		Icon: workspaceIcons[icon],
		color: workspaceColors[color],
	};
}

export function getWorkspaceRecencyLabel(workspace: WorkspaceSummary) {
	if (!workspace.lastOpenedAt) {
		return null;
	}

	return `Opened ${formatWorkspaceRecency(workspace.lastOpenedAt)}`;
}

export function formatWorkspaceRecency(timestamp: string, now = new Date()) {
	const date = new Date(timestamp);

	if (Number.isNaN(date.getTime())) {
		return "recently";
	}

	if (isSameLocalDay(date, now)) {
		return workspaceRecencyTimeFormatter.format(date);
	}

	const dayDelta = getLocalDayDelta(date, now);

	if (dayDelta > 0) {
		return `${dayDelta} ${dayDelta === 1 ? "day" : "days"} ago`;
	}

	return date.getFullYear() === now.getFullYear()
		? workspaceRecencyDateFormatter.format(date)
		: workspaceRecencyDateWithYearFormatter.format(date);
}

function isSameLocalDay(left: Date, right: Date) {
	return (
		left.getFullYear() === right.getFullYear() &&
		left.getMonth() === right.getMonth() &&
		left.getDate() === right.getDate()
	);
}

function getLocalDayDelta(date: Date, now: Date) {
	const dateDay = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	).getTime();
	const nowDay = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	).getTime();

	return Math.floor((nowDay - dateDay) / 86_400_000);
}
