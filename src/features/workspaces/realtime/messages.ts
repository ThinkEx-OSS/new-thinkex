import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";

export const workspaceRealtimePrefix = "api/realtime";
export const workspaceRealtimeParty = "workspace-room";

export interface WorkspacePresenceUser {
	id: string;
	connectionId: string;
	name: string;
	image: string | null;
}

export interface WorkspaceRealtimeEvent {
	id: string;
	type: "workspace.item.created";
	workspaceId: string;
	itemId: string;
	actorUserId: string | null;
	createdAt: string;
	payload: { item: WorkspaceItemSummary };
}

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
