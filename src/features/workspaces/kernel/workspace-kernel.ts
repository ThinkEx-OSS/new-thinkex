import { Workspace as ShellWorkspace } from "@cloudflare/shell";
import { Agent, type Connection, type ConnectionContext } from "agents";

import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
import { WorkspaceKernelEventBus } from "#/features/workspaces/kernel/workspace-kernel-events";
import { WorkspaceKernelFileCommands } from "#/features/workspaces/kernel/workspace-kernel-file-commands";
import { WorkspaceKernelItemCommands } from "#/features/workspaces/kernel/workspace-kernel-item-commands";
import {
	getWorkspaceKernelPresenceUsers,
	getWorkspaceKernelUserFromHeaders,
	setWorkspaceKernelUserHeaders,
} from "#/features/workspaces/kernel/workspace-kernel-presence";
import {
	initializeWorkspaceKernelStorage,
	type WorkspaceKernelSql,
} from "#/features/workspaces/kernel/workspace-kernel-schema";
import { WorkspaceKernelStore } from "#/features/workspaces/kernel/workspace-kernel-store";
import type {
	CreateWorkspaceKernelFileFromUploadArgs,
	CreateWorkspaceKernelItemArgs,
	DeleteWorkspaceKernelItemsArgs,
	DeleteWorkspaceKernelItemsResult,
	ListWorkspaceKernelEventsArgs,
	ListWorkspaceKernelItemsArgs,
	MoveWorkspaceKernelItemsArgs,
	MoveWorkspaceKernelItemsResult,
	ReadWorkspaceKernelFileContentArgs,
	ReadWorkspaceKernelFileProjectionArgs,
	ReadWorkspaceKernelItemArgs,
	RenameWorkspaceKernelItemArgs,
	UpdateWorkspaceKernelItemColorArgs,
	UpsertWorkspaceKernelFileProjectionArgs,
	WorkspaceKernelPage,
	WriteWorkspaceKernelItemArgs,
} from "#/features/workspaces/kernel/workspace-kernel-types";
import type {
	WorkspaceCommandResult,
	WorkspaceConnectionState,
	WorkspaceRealtimeEvent,
	WorkspaceRealtimeServerMessage,
} from "#/features/workspaces/realtime/messages";

const workspaceKernelInlineThresholdBytes = 1_500_000;

export { setWorkspaceKernelUserHeaders };

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
	private readonly events = new WorkspaceKernelEventBus({
		sql: this.kernelSql,
		workspaceId: () => this.name,
		getNextRevision: () => this.store.getNextRevision(),
		broadcast: (message) => this.broadcastRealtimeMessage(message),
	});
	private readonly itemCommands = new WorkspaceKernelItemCommands({
		events: this.events,
		sql: this.kernelSql,
		store: this.store,
		workspace: this.workspace,
		workspaceId: () => this.name,
	});
	private readonly fileCommands = new WorkspaceKernelFileCommands({
		events: this.events,
		r2: this.env.WORKSPACE_KERNEL_FILES,
		sql: this.kernelSql,
		store: this.store,
		workspace: this.workspace,
	});

	onStart() {
		initializeWorkspaceKernelStorage(this.kernelSql);
	}

	onConnect(
		connection: Connection<WorkspaceConnectionState>,
		context: ConnectionContext,
	) {
		const user = getWorkspaceKernelUserFromHeaders(context.request);

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
		return await this.itemCommands.createItem(input);
	}

	async createFileFromUpload(
		input: CreateWorkspaceKernelFileFromUploadArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		return await this.fileCommands.createFileFromUpload(input);
	}

	async readFileContent(input: ReadWorkspaceKernelFileContentArgs) {
		return await this.fileCommands.readFileContent(input);
	}

	async upsertFileProjection(input: UpsertWorkspaceKernelFileProjectionArgs) {
		return await this.fileCommands.upsertFileProjection(input);
	}

	async readFileProjection(input: ReadWorkspaceKernelFileProjectionArgs) {
		return await this.fileCommands.readFileProjection(input);
	}

	async renameItem(
		input: RenameWorkspaceKernelItemArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		return await this.itemCommands.renameItem(input);
	}

	async moveItems(
		input: MoveWorkspaceKernelItemsArgs,
	): Promise<WorkspaceCommandResult<MoveWorkspaceKernelItemsResult>> {
		return await this.itemCommands.moveItems(input);
	}

	async updateItemColor(
		input: UpdateWorkspaceKernelItemColorArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		return await this.itemCommands.updateItemColor(input);
	}

	async deleteItems(
		input: DeleteWorkspaceKernelItemsArgs,
	): Promise<WorkspaceCommandResult<DeleteWorkspaceKernelItemsResult>> {
		return await this.itemCommands.deleteItems(input);
	}

	async readItem(input: ReadWorkspaceKernelItemArgs) {
		return await this.itemCommands.readItem(input);
	}

	async writeItem(
		input: WriteWorkspaceKernelItemArgs,
	): Promise<WorkspaceCommandResult<WorkspaceItemSummary>> {
		return await this.itemCommands.writeItem(input);
	}

	async getEventsSince({
		afterRevision,
		limit = 100,
	}: ListWorkspaceKernelEventsArgs): Promise<WorkspaceRealtimeEvent[]> {
		return this.events.getEventsSince({ afterRevision, limit });
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
		return getWorkspaceKernelPresenceUsers(
			this.getConnections<WorkspaceConnectionState>(),
		);
	}
}
