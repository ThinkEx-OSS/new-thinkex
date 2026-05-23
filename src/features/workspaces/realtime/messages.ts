export const workspaceRealtimePrefix = "api/realtime";
export const workspaceRealtimeParty = "workspace-room";

export interface WorkspacePresenceUser {
	id: string;
	connectionId: string;
	name: string;
	image: string | null;
}

export type WorkspaceRealtimeServerMessage = {
	type: "presence.snapshot";
	workspaceId: string;
	users: WorkspacePresenceUser[];
};

export interface WorkspaceConnectionState {
	user: Omit<WorkspacePresenceUser, "connectionId">;
}
