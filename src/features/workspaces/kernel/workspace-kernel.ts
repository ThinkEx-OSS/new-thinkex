import { Workspace as ShellWorkspace } from "@cloudflare/shell";
import { Agent, type Connection, type ConnectionContext } from "agents";

import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
import { workspaceItemTypeSchema } from "#/features/workspaces/contracts";
import {
	getInitialWorkspaceKernelContent,
	getWorkspaceKernelContentMimeType,
	getWorkspaceKernelShellPath,
} from "#/features/workspaces/kernel/workspace-kernel-files";
import {
	type KernelEventRow,
	mapKernelEventRow,
	mapKernelItemRow,
} from "#/features/workspaces/kernel/workspace-kernel-rows";
import {
	initializeWorkspaceKernelStorage,
	kernelItemsTable,
	type WorkspaceKernelSql,
} from "#/features/workspaces/kernel/workspace-kernel-schema";
import { WorkspaceKernelStore } from "#/features/workspaces/kernel/workspace-kernel-store";
import type {
	CreateWorkspaceKernelItemArgs,
	DeleteWorkspaceKernelItemArgs,
	DeleteWorkspaceKernelItemResult,
	ListWorkspaceKernelEventsArgs,
	ListWorkspaceKernelItemsArgs,
	MoveWorkspaceKernelItemArgs,
	ReadWorkspaceKernelItemArgs,
	RenameWorkspaceKernelItemArgs,
	WorkspaceKernelPage,
	WriteWorkspaceKernelItemArgs,
} from "#/features/workspaces/kernel/workspace-kernel-types";
import type {
	WorkspaceCommandResult,
	WorkspaceConnectionState,
	WorkspacePresenceUser,
	WorkspaceRealtimeEvent,
	WorkspaceRealtimeServerMessage,
} from "#/features/workspaces/realtime/messages";

const USER_ID_HEADER = "x-thinkex-user-id";
const USER_NAME_HEADER = "x-thinkex-user-name";
const USER_IMAGE_HEADER = "x-thinkex-user-image";
const workspaceKernelInlineThresholdBytes = 1_500_000;

export class WorkspaceKernel extends Agent<Env> {
	private readonly kernelSql: WorkspaceKernelSql = (strings, ...values) =>
		this.sql(strings, ...values);
	private readonly workspace = new ShellWorkspace({
		sql: this.ctx.storage.sql,
		r2: this.env.WORKSPACE_KERNEL_FILES,
		inlineThreshold: workspaceKernelInlineThresholdBytes,
		namespace: "workspace_kernel_files",
		name: () => this.name,
	});
	private readonly store = new WorkspaceKernelStore({
		sql: this.kernelSql,
		workspaceId: () => this.name,
	});

	onStart() {
		initializeWorkspaceKernelStorage(this.kernelSql);
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
			items: this.store.getPageItems(),
			revision: this.store.getCurrentRevision(),
		};
	}

	async listItems(input: ListWorkspaceKernelItemsArgs = {}) {
		return this.store.listItems(input);
	}

	async createItem(
		input: CreateWorkspaceKernelItemArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		const type = workspaceItemTypeSchema.parse(input.type);
		const id = input.id ?? crypto.randomUUID();
		const parentId = input.parentId ?? null;
		const now = Date.now();

		if (this.store.getItemRowIncludingDeleted(id)) {
			throw new Error("Workspace item id already exists.");
		}

		this.store.assertParentIsValid(parentId);
		const name = this.store.getAvailableItemName({
			type,
			parentId,
			requestedName: input.name,
		});

		const shellPath = getWorkspaceKernelShellPath({ id, type });
		const sortOrder = this.store.getNextSortOrder(parentId);
		const metadataJson = JSON.stringify(input.metadataJson ?? {});

		if (type === "folder") {
			await this.workspace.mkdir(shellPath, { recursive: true });
		} else {
			await this.workspace.writeFile(
				shellPath,
				input.initialContent ?? getInitialWorkspaceKernelContent(type, name),
				getWorkspaceKernelContentMimeType(type),
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

		const item = this.store.requireItem(id);
		const event = this.commitWorkspaceEvent({
			type: "workspace.item.created",
			actorUserId: input.actorUserId ?? null,
			clientMutationId: input.clientMutationId ?? null,
			payload: { item },
		});

		return {
			result: item,
			event,
		};
	}

	async renameItem(
		input: RenameWorkspaceKernelItemArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		if (!input.name.trim()) {
			throw new Error("Item name is required.");
		}

		const existingItem = this.store.assertActiveItem(input.itemId);
		const type = workspaceItemTypeSchema.parse(existingItem.type);
		const name = this.store.getAvailableItemName({
			type,
			parentId: existingItem.parent_id,
			requestedName: input.name,
			excludeItemId: existingItem.id,
		});

		this.sql`
			UPDATE kernel_items
			SET name = ${name}, updated_at = ${Date.now()}
			WHERE id = ${input.itemId} AND deleted_at IS NULL
		`;

		const item = this.store.requireItem(input.itemId);
		const event = this.commitWorkspaceEvent({
			type: "workspace.item.renamed",
			actorUserId: input.actorUserId ?? null,
			clientMutationId: input.clientMutationId ?? null,
			payload: { item },
		});

		return {
			result: item,
			event,
		};
	}

	async moveItem(
		input: MoveWorkspaceKernelItemArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		const parentId = input.parentId ?? null;

		const existingItem = this.store.assertActiveItem(input.itemId);
		this.store.assertParentIsValid(parentId);
		this.store.assertNotMovingIntoDescendant(input.itemId, parentId);
		const type = workspaceItemTypeSchema.parse(existingItem.type);
		const name = this.store.getAvailableItemName({
			type,
			parentId,
			requestedName: existingItem.name,
			excludeItemId: existingItem.id,
		});

		this.sql`
			UPDATE kernel_items
			SET
				parent_id = ${parentId},
				name = ${name},
				sort_order = ${input.sortOrder ?? this.store.getNextSortOrder(parentId)},
				updated_at = ${Date.now()}
			WHERE id = ${input.itemId} AND deleted_at IS NULL
		`;

		const item = this.store.requireItem(input.itemId);
		const event = this.commitWorkspaceEvent({
			type: "workspace.item.moved",
			actorUserId: input.actorUserId ?? null,
			clientMutationId: input.clientMutationId ?? null,
			payload: { item },
		});

		return {
			result: item,
			event,
		};
	}

	async deleteItem(
		input: DeleteWorkspaceKernelItemArgs,
	): Promise<WorkspaceCommandResult<DeleteWorkspaceKernelItemResult>> {
		const root = this.store.assertActiveItem(input.itemId);
		const now = Date.now();
		const deleteIds = [root.id, ...this.store.getDescendantIds(root.id)];
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
				const row = this.store.getItemRowIncludingDeleted(id);

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
		};
	}

	async readItem(input: ReadWorkspaceKernelItemArgs) {
		const item = this.store.assertActiveItem(input.itemId);

		if (item.type === "folder") {
			return {
				item: mapKernelItemRow(item, this.name),
				content: null,
			};
		}

		return {
			item: mapKernelItemRow(item, this.name),
			content: await this.workspace.readFile(item.shell_path),
		};
	}

	async writeItem(
		input: WriteWorkspaceKernelItemArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		const item = this.store.assertActiveItem(input.itemId);

		if (item.type === "folder") {
			throw new Error("Folders do not have writable content.");
		}

		await this.workspace.writeFile(
			item.shell_path,
			input.content,
			getWorkspaceKernelContentMimeType(
				workspaceItemTypeSchema.parse(item.type),
			),
		);

		this.sql`
			UPDATE kernel_items
			SET updated_at = ${Date.now()}
			WHERE id = ${input.itemId} AND deleted_at IS NULL
		`;

		const itemSummary = this.store.requireItem(input.itemId);
		const event = this.commitWorkspaceEvent({
			type: "workspace.item.content.updated",
			actorUserId: input.actorUserId ?? null,
			clientMutationId: input.clientMutationId ?? null,
			payload: { item: itemSummary },
		});

		return {
			result: itemSummary,
			event,
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

		return rows.map((row) => mapKernelEventRow(row, this.name));
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
			revision: this.store.getNextRevision(),
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
