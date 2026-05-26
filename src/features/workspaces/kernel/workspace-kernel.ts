import { Workspace as ShellWorkspace } from "@cloudflare/shell";
import { Agent, type Connection, type ConnectionContext } from "agents";

import type {
	JsonValue,
	WorkspaceItemSummary,
	WorkspaceItemType,
} from "#/features/workspaces/contracts";
import { workspaceItemTypeSchema } from "#/features/workspaces/contracts";
import { getDefaultWorkspaceItemName } from "#/features/workspaces/defaults";
import type {
	WorkspaceCommandResult,
	WorkspaceConnectionState,
	WorkspacePresenceUser,
	WorkspaceRealtimeEvent,
	WorkspaceRealtimeServerMessage,
} from "#/features/workspaces/realtime/messages";

const kernelItemsTable = "kernel_items";
const workspaceRevisionKey = "workspace_revision";
const itemSortStep = 1024;
const USER_ID_HEADER = "x-thinkex-user-id";
const USER_NAME_HEADER = "x-thinkex-user-name";
const USER_IMAGE_HEADER = "x-thinkex-user-image";

type KernelItemRow = {
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

type KernelEventRow = {
	id: string;
	revision: number;
	type: WorkspaceRealtimeEvent["type"];
	actor_user_id: string | null;
	client_mutation_id: string | null;
	payload_json: string;
	created_at: number;
};

export interface WorkspaceKernelPage {
	workspaceId: string;
	items: WorkspaceItemSummary[];
	revision: number;
}

export interface ListWorkspaceKernelItemsArgs {
	parentId?: string | null;
	limit?: number;
}

export interface CreateWorkspaceKernelItemArgs {
	id?: string;
	parentId?: string | null;
	type: WorkspaceItemType;
	name?: string;
	color?: string | null;
	metadataJson?: Record<string, JsonValue>;
	initialContent?: string;
	actorUserId?: string | null;
	clientMutationId?: string | null;
}

export interface RenameWorkspaceKernelItemArgs {
	itemId: string;
	name: string;
	actorUserId?: string | null;
	clientMutationId?: string | null;
}

export interface MoveWorkspaceKernelItemArgs {
	itemId: string;
	parentId?: string | null;
	sortOrder?: number;
	actorUserId?: string | null;
	clientMutationId?: string | null;
}

export interface DeleteWorkspaceKernelItemArgs {
	itemId: string;
	actorUserId?: string | null;
	clientMutationId?: string | null;
}

export interface ReadWorkspaceKernelItemArgs {
	itemId: string;
}

export interface WriteWorkspaceKernelItemArgs {
	itemId: string;
	content: string;
	actorUserId?: string | null;
	clientMutationId?: string | null;
}

export interface DeleteWorkspaceKernelItemResult {
	id: string;
	deletedItemIds: string[];
}

export interface ListWorkspaceKernelEventsArgs {
	afterRevision: number;
	limit?: number;
}

export class WorkspaceKernel extends Agent<Env> {
	private readonly workspace = new ShellWorkspace({
		sql: this.ctx.storage.sql,
		namespace: "workspace_kernel_files",
		name: () => this.name,
	});

	onStart() {
		this.sql`
			CREATE TABLE IF NOT EXISTS kernel_items (
				id TEXT PRIMARY KEY,
				parent_id TEXT,
				type TEXT NOT NULL,
				name TEXT NOT NULL,
				color TEXT,
				metadata_json TEXT NOT NULL DEFAULT '{}',
				sort_order INTEGER NOT NULL,
				shell_path TEXT NOT NULL UNIQUE,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				deleted_at INTEGER
			)
		`;
		this.sql`CREATE INDEX IF NOT EXISTS kernel_items_parent_idx
			ON kernel_items (parent_id, deleted_at, sort_order)`;
		this.sql`CREATE INDEX IF NOT EXISTS kernel_items_type_idx
			ON kernel_items (type, deleted_at)`;
		this.sql`
			CREATE TABLE IF NOT EXISTS kernel_meta (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`;
		this.sql`
			CREATE TABLE IF NOT EXISTS kernel_events (
				id TEXT PRIMARY KEY,
				revision INTEGER NOT NULL UNIQUE,
				type TEXT NOT NULL,
				actor_user_id TEXT,
				client_mutation_id TEXT,
				payload_json TEXT NOT NULL,
				created_at INTEGER NOT NULL
			)
		`;
		this.sql`CREATE INDEX IF NOT EXISTS kernel_events_revision_idx
			ON kernel_events (revision)`;
	}

	onConnect(
		connection: Connection<WorkspaceConnectionState>,
		context: ConnectionContext,
	) {
		const user = getUserFromHeaders(context.request);

		if (!user) {
			connection.close(1008, "Unauthorized");
			return;
		}

		connection.setState({
			user,
		});
		this.broadcastPresenceSnapshot();
	}

	onClose() {
		this.broadcastPresenceSnapshot();
	}

	async getPage(): Promise<WorkspaceKernelPage> {
		return {
			workspaceId: this.name,
			items: this.getActiveItems(),
			revision: this.getCurrentRevision(),
		};
	}

	async listItems({
		parentId = null,
		limit = 80,
	}: ListWorkspaceKernelItemsArgs = {}) {
		const parentFilter = parentId ?? null;
		const rows = this.sql<KernelItemRow>`
			SELECT *
			FROM kernel_items
			WHERE deleted_at IS NULL
				AND (
					(${parentFilter} IS NULL AND parent_id IS NULL)
					OR parent_id = ${parentFilter}
				)
			ORDER BY sort_order ASC, name ASC
			LIMIT ${Math.max(1, Math.min(limit, 500))}
		`;

		return rows.map((row) => this.mapItemRow(row));
	}

	async createItem(
		input: CreateWorkspaceKernelItemArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		const type = workspaceItemTypeSchema.parse(input.type);
		const id = input.id ?? crypto.randomUUID();
		const parentId = input.parentId ?? null;
		const now = Date.now();
		const name = input.name?.trim() || getDefaultWorkspaceItemName(type);

		await this.assertParentIsValid(parentId);

		const shellPath = getShellPath({ id, type });
		const sortOrder = this.getNextSortOrder(parentId);
		const metadataJson = JSON.stringify(input.metadataJson ?? {});

		if (type === "folder") {
			await this.workspace.mkdir(shellPath, { recursive: true });
		} else {
			await this.workspace.writeFile(
				shellPath,
				input.initialContent ?? getInitialContent(type),
				getContentMimeType(type),
			);
		}

		this.sql`
			INSERT INTO kernel_items (
				id,
				parent_id,
				type,
				name,
				color,
				metadata_json,
				sort_order,
				shell_path,
				created_at,
				updated_at,
				deleted_at
			)
			VALUES (
				${id},
				${parentId},
				${type},
				${name},
				${input.color ?? null},
				${metadataJson},
				${sortOrder},
				${shellPath},
				${now},
				${now},
				NULL
			)
		`;

		const item = this.requireItem(id);
		const event = this.commitWorkspaceEvent({
			type: "workspace.item.created",
			actorUserId: input.actorUserId ?? null,
			clientMutationId: input.clientMutationId ?? null,
			payload: { item },
		});

		return {
			result: item,
			event,
			revision: event.revision,
		};
	}

	async renameItem(
		input: RenameWorkspaceKernelItemArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		const name = input.name.trim();

		if (!name) {
			throw new Error("Item name is required.");
		}

		this.assertActiveItem(input.itemId);
		this.sql`
			UPDATE kernel_items
			SET name = ${name}, updated_at = ${Date.now()}
			WHERE id = ${input.itemId} AND deleted_at IS NULL
		`;

		const item = this.requireItem(input.itemId);
		const event = this.commitWorkspaceEvent({
			type: "workspace.item.renamed",
			actorUserId: input.actorUserId ?? null,
			clientMutationId: input.clientMutationId ?? null,
			payload: { item },
		});

		return {
			result: item,
			event,
			revision: event.revision,
		};
	}

	async moveItem(
		input: MoveWorkspaceKernelItemArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		const parentId = input.parentId ?? null;

		this.assertActiveItem(input.itemId);
		await this.assertParentIsValid(parentId);
		this.assertNotMovingIntoDescendant(input.itemId, parentId);

		this.sql`
			UPDATE kernel_items
			SET
				parent_id = ${parentId},
				sort_order = ${input.sortOrder ?? this.getNextSortOrder(parentId)},
				updated_at = ${Date.now()}
			WHERE id = ${input.itemId} AND deleted_at IS NULL
		`;

		const item = this.requireItem(input.itemId);
		const event = this.commitWorkspaceEvent({
			type: "workspace.item.moved",
			actorUserId: input.actorUserId ?? null,
			clientMutationId: input.clientMutationId ?? null,
			payload: { item },
		});

		return {
			result: item,
			event,
			revision: event.revision,
		};
	}

	async deleteItem(
		input: DeleteWorkspaceKernelItemArgs,
	): Promise<WorkspaceCommandResult<DeleteWorkspaceKernelItemResult>> {
		const root = this.assertActiveItem(input.itemId);
		const now = Date.now();
		const deleteIds = [root.id, ...this.getDescendantIds(root.id)];
		const placeholders = deleteIds.map(() => "?").join(", ");

		this.ctx.storage.sql.exec(
			`UPDATE ${kernelItemsTable}
			 SET deleted_at = ?, updated_at = ?
			 WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
			now,
			now,
			...deleteIds,
		);

		await Promise.all(
			deleteIds.map(async (id) => {
				const row = this.getItemRowIncludingDeleted(id);

				if (row) {
					await this.workspace.rm(row.shell_path, {
						recursive: true,
						force: true,
					});
				}
			}),
		);

		const result = { id: root.id, deletedItemIds: deleteIds };
		const event = this.commitWorkspaceEvent({
			type: "workspace.item.deleted",
			actorUserId: input.actorUserId ?? null,
			clientMutationId: input.clientMutationId ?? null,
			payload: { itemId: root.id, deletedItemIds: deleteIds },
		});

		return {
			result,
			event,
			revision: event.revision,
		};
	}

	async readItem(input: ReadWorkspaceKernelItemArgs) {
		const item = this.assertActiveItem(input.itemId);

		if (item.type === "folder") {
			return {
				item: this.mapItemRow(item),
				content: null,
			};
		}

		return {
			item: this.mapItemRow(item),
			content: await this.workspace.readFile(item.shell_path),
		};
	}

	async writeItem(
		input: WriteWorkspaceKernelItemArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		const item = this.assertActiveItem(input.itemId);

		if (item.type === "folder") {
			throw new Error("Folders do not have writable content.");
		}

		await this.workspace.writeFile(
			item.shell_path,
			input.content,
			getContentMimeType(workspaceItemTypeSchema.parse(item.type)),
		);

		this.sql`
			UPDATE kernel_items
			SET updated_at = ${Date.now()}
			WHERE id = ${input.itemId} AND deleted_at IS NULL
		`;

		const itemSummary = this.requireItem(input.itemId);
		const event = this.commitWorkspaceEvent({
			type: "workspace.item.content.updated",
			actorUserId: input.actorUserId ?? null,
			clientMutationId: input.clientMutationId ?? null,
			payload: { item: itemSummary },
		});

		return {
			result: itemSummary,
			event,
			revision: event.revision,
		};
	}

	async getEventsSince({
		afterRevision,
		limit = 100,
	}: ListWorkspaceKernelEventsArgs): Promise<WorkspaceRealtimeEvent[]> {
		const rows = this.sql<KernelEventRow>`
			SELECT *
			FROM kernel_events
			WHERE revision > ${Math.max(0, afterRevision)}
			ORDER BY revision ASC
			LIMIT ${Math.max(1, Math.min(limit, 500))}
		`;

		return rows.map((row) => this.mapEventRow(row));
	}

	private getActiveItems() {
		return this.sql<KernelItemRow>`
			SELECT *
			FROM kernel_items
			WHERE deleted_at IS NULL
			ORDER BY parent_id ASC, sort_order ASC, name ASC
		`.map((row) => this.mapItemRow(row));
	}

	private getCurrentRevision() {
		const [row] = this.sql<{ value: string }>`
			SELECT value
			FROM kernel_meta
			WHERE key = ${workspaceRevisionKey}
			LIMIT 1
		`;

		return Number.parseInt(row?.value ?? "0", 10) || 0;
	}

	private getNextRevision() {
		const nextRevision = this.getCurrentRevision() + 1;
		this.sql`
			INSERT INTO kernel_meta (key, value, updated_at)
			VALUES (${workspaceRevisionKey}, ${String(nextRevision)}, ${Date.now()})
			ON CONFLICT(key) DO UPDATE SET
				value = excluded.value,
				updated_at = excluded.updated_at
		`;

		return nextRevision;
	}

	private commitWorkspaceEvent(
		input: Omit<
			WorkspaceRealtimeEvent,
			"id" | "revision" | "workspaceId" | "createdAt"
		>,
	) {
		const createdAt = Date.now();
		const event = {
			id: crypto.randomUUID(),
			revision: this.getNextRevision(),
			workspaceId: this.name,
			createdAt: new Date(createdAt).toISOString(),
			...input,
		} as WorkspaceRealtimeEvent;

		this.sql`
			INSERT INTO kernel_events (
				id,
				revision,
				type,
				actor_user_id,
				client_mutation_id,
				payload_json,
				created_at
			)
			VALUES (
				${event.id},
				${event.revision},
				${event.type},
				${event.actorUserId},
				${event.clientMutationId},
				${JSON.stringify(event.payload)},
				${createdAt}
			)
		`;
		this.broadcastWorkspaceEvent(event);

		return event;
	}

	private broadcastWorkspaceEvent(event: WorkspaceRealtimeEvent) {
		this.broadcastRealtimeMessage({
			type: "workspace.event",
			workspaceId: this.name,
			event,
		});
	}

	private getNextSortOrder(parentId: string | null) {
		const [row] = this.sql<{ max_sort_order: number | null }>`
			SELECT MAX(sort_order) AS max_sort_order
			FROM kernel_items
			WHERE deleted_at IS NULL
				AND (
					(${parentId} IS NULL AND parent_id IS NULL)
					OR parent_id = ${parentId}
				)
		`;

		return (row?.max_sort_order ?? 0) + itemSortStep;
	}

	private async assertParentIsValid(parentId: string | null) {
		if (!parentId) {
			return;
		}

		const parent = this.assertActiveItem(parentId);

		if (parent.type !== "folder") {
			throw new Error("Items can only be moved into folders.");
		}
	}

	private assertNotMovingIntoDescendant(
		itemId: string,
		parentId: string | null,
	) {
		if (!parentId) {
			return;
		}

		if (
			itemId === parentId ||
			this.getDescendantIds(itemId).includes(parentId)
		) {
			throw new Error("An item cannot be moved into itself.");
		}
	}

	private getDescendantIds(itemId: string) {
		const descendantIds: string[] = [];
		const parentIds = [itemId];

		for (let index = 0; index < parentIds.length; index += 1) {
			const parentId = parentIds[index];

			if (!parentId) {
				continue;
			}

			const rows = this.sql<{ id: string }>`
				SELECT id
				FROM kernel_items
				WHERE parent_id = ${parentId} AND deleted_at IS NULL
			`;

			for (const row of rows) {
				descendantIds.push(row.id);
				parentIds.push(row.id);
			}
		}

		return descendantIds;
	}

	private requireItem(itemId: string) {
		return this.mapItemRow(this.assertActiveItem(itemId));
	}

	private assertActiveItem(itemId: string) {
		const row = this.getItemRow(itemId);

		if (!row) {
			throw new Error("Workspace item not found.");
		}

		return row;
	}

	private getItemRow(itemId: string) {
		return (
			this.sql<KernelItemRow>`
				SELECT *
				FROM kernel_items
				WHERE id = ${itemId} AND deleted_at IS NULL
				LIMIT 1
			`[0] ?? null
		);
	}

	private getItemRowIncludingDeleted(itemId: string) {
		return (
			this.sql<KernelItemRow>`
				SELECT *
				FROM kernel_items
				WHERE id = ${itemId}
				LIMIT 1
			`[0] ?? null
		);
	}

	private mapItemRow(row: KernelItemRow): WorkspaceItemSummary {
		const type = workspaceItemTypeSchema.parse(row.type);

		return {
			id: row.id,
			workspaceId: this.name,
			parentId: row.parent_id,
			type,
			title: row.name,
			name: row.name,
			meta: getItemMeta(type),
			color: row.color,
			metadataJson: parseMetadataJson(row.metadata_json),
			sortOrder: row.sort_order,
			createdAt: new Date(row.created_at).toISOString(),
			updatedAt: new Date(row.updated_at).toISOString(),
			deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
		};
	}

	private mapEventRow(row: KernelEventRow): WorkspaceRealtimeEvent {
		return {
			id: row.id,
			revision: row.revision,
			workspaceId: this.name,
			type: row.type,
			actorUserId: row.actor_user_id,
			clientMutationId: row.client_mutation_id,
			createdAt: new Date(row.created_at).toISOString(),
			payload: JSON.parse(
				row.payload_json,
			) as WorkspaceRealtimeEvent["payload"],
		} as WorkspaceRealtimeEvent;
	}

	private broadcastPresenceSnapshot() {
		this.broadcastRealtimeMessage({
			type: "presence.snapshot",
			workspaceId: this.name,
			users: this.getPresenceUsers(),
		});
	}

	private broadcastRealtimeMessage(message: WorkspaceRealtimeServerMessage) {
		this.broadcast(JSON.stringify(message));
	}

	private getPresenceUsers() {
		const usersByConnectionId = new Map<string, WorkspacePresenceUser>();

		for (const connection of this.getConnections<WorkspaceConnectionState>()) {
			const user = connection.state?.user;

			if (!user) {
				continue;
			}

			usersByConnectionId.set(connection.id, {
				...user,
				connectionId: connection.id,
			});
		}

		return Array.from(usersByConnectionId.values()).sort((first, second) =>
			first.name.localeCompare(second.name),
		);
	}
}

export function setWorkspaceKernelUserHeaders(
	request: Request,
	user: Omit<WorkspacePresenceUser, "connectionId">,
) {
	const headers = new Headers(request.headers);
	headers.set(USER_ID_HEADER, user.id);
	headers.set(USER_NAME_HEADER, user.name);

	if (user.image) {
		headers.set(USER_IMAGE_HEADER, user.image);
	} else {
		headers.delete(USER_IMAGE_HEADER);
	}

	return new Request(request, { headers });
}

function getUserFromHeaders(request: Request) {
	const userId = request.headers.get(USER_ID_HEADER);
	const name = request.headers.get(USER_NAME_HEADER);

	if (!userId || !name) {
		return null;
	}

	return {
		id: userId,
		name,
		image: request.headers.get(USER_IMAGE_HEADER),
	};
}

function getShellPath(input: { id: string; type: WorkspaceItemType }) {
	if (input.type === "folder") {
		return `/items/${input.id}`;
	}

	return `/items/${input.id}/content.${getContentExtension(input.type)}`;
}

function getContentExtension(type: WorkspaceItemType) {
	switch (type) {
		case "document":
			return "md";
		case "flashcard":
		case "quiz":
			return "json";
		case "file":
			return "txt";
		case "folder":
			return "";
	}
}

function getContentMimeType(type: WorkspaceItemType) {
	switch (type) {
		case "document":
			return "text/markdown";
		case "flashcard":
		case "quiz":
			return "application/json";
		case "file":
			return "text/plain";
		case "folder":
			return "inode/directory";
	}
}

function getInitialContent(type: WorkspaceItemType) {
	switch (type) {
		case "document":
			return "# Untitled Document\n";
		case "flashcard":
			return JSON.stringify({ version: 1, cards: [] }, null, 2);
		case "quiz":
			return JSON.stringify({ version: 1, questions: [] }, null, 2);
		case "file":
			return "";
		case "folder":
			return "";
	}
}

function getItemMeta(type: WorkspaceItemType) {
	switch (type) {
		case "folder":
			return "Folder";
		case "document":
			return "Document";
		case "file":
			return "File";
		case "flashcard":
			return "Flashcards";
		case "quiz":
			return "Quiz";
	}
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
