import type {
	WorkspaceItemMoveRowSnapshot,
	WorkspaceItemSummary,
	WorkspaceMutationActorType,
	WorkspaceMutationOperation,
} from "#/features/workspaces/contracts";

export const workspaceRealtimePrefix = "api/realtime";
export const workspaceRealtimeParty = "workspace-room";

export interface WorkspacePresenceUser {
	id: string;
	connectionId: string;
	name: string;
	image: string | null;
}

interface WorkspaceRealtimeEventBase {
	id: string;
	workspaceId: string;
	itemId: string;
	actorType: WorkspaceMutationActorType;
	actorUserId: string | null;
	actorAgentSessionId?: string | null;
	createdAt: string;
	operation: WorkspaceMutationOperation;
}

export type WorkspaceRealtimeEvent =
	| (WorkspaceRealtimeEventBase & {
			type: "workspace.item.created" | "workspace.item.renamed";
			payload: { item: WorkspaceItemSummary };
	  })
	| (WorkspaceRealtimeEventBase & {
			type: "workspace.items.reordered";
			payload: {
				parentId: string | null;
				row: "folder" | "item";
				items: WorkspaceItemSummary[];
				clientMutationId?: string;
			};
	  })
	| (WorkspaceRealtimeEventBase & {
			type: "workspace.item.moved";
			payload: {
				item: WorkspaceItemSummary;
				source: WorkspaceItemMoveRowSnapshot;
				destination: WorkspaceItemMoveRowSnapshot;
				clientMutationId?: string;
			};
	  })
	| (WorkspaceRealtimeEventBase & {
			type: "workspace.item.deleted";
			payload: {
				deletedItemIds: string[];
				reparentedItems: WorkspaceItemSummary[];
			};
	  });

export type WorkspaceRealtimeServerMessage =
	| {
			type: "presence.snapshot";
			workspaceId: string;
			users: WorkspacePresenceUser[];
	  }
	| {
			type: "workspace.event";
			workspaceId: string;
			event: WorkspaceRealtimeEvent;
	  };

export interface WorkspaceConnectionState {
	user: Omit<WorkspacePresenceUser, "connectionId">;
}
