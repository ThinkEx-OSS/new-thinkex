import type { InferSelectModel } from "drizzle-orm";
import { z } from "zod";

import type { workspaceItems, workspaces } from "#/db/schema";
import type {
	WorkspaceDetail,
	WorkspaceItemSummary,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import {
	jsonValueSchema,
	workspaceColorSchema,
	workspaceIconSchema,
} from "#/features/workspaces/contracts";
import {
	DEFAULT_WORKSPACE_COLOR,
	DEFAULT_WORKSPACE_ICON,
} from "#/features/workspaces/defaults";

type WorkspaceRow = InferSelectModel<typeof workspaces>;
type WorkspaceItemRow = InferSelectModel<typeof workspaceItems>;
type WorkspaceSummaryRow = WorkspaceRow & {
	lastOpenedAt?: Date | null;
};

function toIsoString(value: Date | null) {
	return value ? value.toISOString() : null;
}

export function mapWorkspaceRow(row: WorkspaceSummaryRow): WorkspaceSummary {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		icon: parseWorkspaceIcon(row.icon),
		color: parseWorkspaceColor(row.color),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		lastOpenedAt: toIsoString(row.lastOpenedAt ?? null),
		archivedAt: toIsoString(row.archivedAt),
	};
}

export function mapWorkspaceDetailRow(
	row: WorkspaceSummaryRow,
): WorkspaceDetail {
	return mapWorkspaceRow(row);
}

export function mapWorkspaceItemRow(
	row: WorkspaceItemRow,
): WorkspaceItemSummary {
	const metadataJson = parseMetadataJson(row.metadataJson);

	return {
		id: row.id,
		workspaceId: row.workspaceId,
		parentId: row.parentId,
		type: row.type,
		title: row.name,
		name: row.name,
		meta: getWorkspaceItemMeta(row),
		color: row.color,
		metadataJson,
		sortOrder: row.sortOrder,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		deletedAt: toIsoString(row.deletedAt),
	};
}

function getWorkspaceItemMeta(row: WorkspaceItemRow) {
	if (row.type === "folder") {
		return "Folder";
	}

	const metadataJson = row.metadataJson;

	if (
		metadataJson &&
		typeof metadataJson === "object" &&
		"summary" in metadataJson &&
		typeof metadataJson.summary === "string"
	) {
		return metadataJson.summary;
	}

	return row.type;
}

function parseWorkspaceIcon(value: string | null) {
	if (value === null) {
		return null;
	}

	return workspaceIconSchema.safeParse(value).data ?? DEFAULT_WORKSPACE_ICON;
}

function parseWorkspaceColor(value: string | null) {
	if (value === null) {
		return null;
	}

	return workspaceColorSchema.safeParse(value).data ?? DEFAULT_WORKSPACE_COLOR;
}

function parseMetadataJson(value: Record<string, unknown> | null) {
	const result = z.record(z.string(), jsonValueSchema).safeParse(value ?? {});

	return result.data ?? {};
}
