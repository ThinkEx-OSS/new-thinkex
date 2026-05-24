import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";

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
	actorUserId: string | null;
	createdAt: string;
}

export type WorkspaceRealtimeEvent =
	| (WorkspaceRealtimeEventBase & {
			type: "workspace.item.created" | "workspace.item.renamed";
			payload: { item: WorkspaceItemSummary };
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
