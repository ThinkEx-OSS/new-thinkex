import type {
	JsonValue,
	WorkspaceItemSummary,
} from "#/features/workspaces/contracts";
import { workspaceItemTypeSchema } from "#/features/workspaces/contracts";
import { getWorkspaceItemTypeMeta } from "#/features/workspaces/defaults";
import type { WorkspaceRealtimeEvent } from "#/features/workspaces/realtime/messages";

export type KernelItemRow = {
	id: string;
	parent_id: string | null;
	type: string;
	name: string;
	color: string | null;
	metadata_json: string;
	sort_order: number;
	shell_path: string;
	created_at: number;
	updated_at: number;
	deleted_at: number | null;
};

export type KernelEventRow = {
	id: string;
	revision: number;
	type: WorkspaceRealtimeEvent["type"];
	actor_user_id: string | null;
	client_mutation_id: string | null;
	payload_json: string;
	created_at: number;
};

export function mapKernelItemRow(
	row: KernelItemRow,
	workspaceId: string,
): WorkspaceItemSummary {
	const type = workspaceItemTypeSchema.parse(row.type);

	return {
		id: row.id,
		workspaceId,
		parentId: row.parent_id,
		type,
		title: row.name,
		name: row.name,
		meta: getWorkspaceItemTypeMeta(type),
		color: row.color,
		metadataJson: parseMetadataJson(row.metadata_json),
		sortOrder: row.sort_order,
		createdAt: new Date(row.created_at).toISOString(),
		updatedAt: new Date(row.updated_at).toISOString(),
		deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
	};
}

export function mapKernelEventRow(
	row: KernelEventRow,
	workspaceId: string,
): WorkspaceRealtimeEvent {
	return {
		id: row.id,
		revision: row.revision,
		workspaceId,
		type: row.type,
		actorUserId: row.actor_user_id,
		clientMutationId: row.client_mutation_id,
		createdAt: new Date(row.created_at).toISOString(),
		payload: parseWorkspaceEventPayload(row),
	} as WorkspaceRealtimeEvent;
}

function parseWorkspaceEventPayload(
	row: KernelEventRow,
): WorkspaceRealtimeEvent["payload"] {
	const payload = JSON.parse(row.payload_json) as unknown;

	if (row.type === "workspace.item.deleted") {
		return normalizeDeletedWorkspaceItemPayload(payload);
	}

	return payload as WorkspaceRealtimeEvent["payload"];
}

function normalizeDeletedWorkspaceItemPayload(
	payload: unknown,
): Extract<
	WorkspaceRealtimeEvent,
	{ type: "workspace.item.deleted" }
>["payload"] {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return { itemIds: [], deletedItemIds: [] };
	}

	const record = payload as Record<string, unknown>;
	const itemIds = getStringArray(record.itemIds);
	const legacyItemId = typeof record.itemId === "string" ? record.itemId : null;

	return {
		itemIds: itemIds.length > 0 ? itemIds : legacyItemId ? [legacyItemId] : [],
		deletedItemIds: getStringArray(record.deletedItemIds),
	};
}

function getStringArray(value: unknown) {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function parseMetadataJson(value: string): Record<string, JsonValue> {
	try {
		const parsed = JSON.parse(value) as unknown;

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}

		return parsed as Record<string, JsonValue>;
	} catch {
		return {};
	}
}
