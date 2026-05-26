export const workspaceKernelRealtimePathPrefix = "/workspace-kernel";

export interface WorkspacePresenceUser {
	id: string;
	connectionId: string;
	name: string;
	image: string | null;
}

interface WorkspaceRealtimeEventBase {
	id: string;
	workspaceId: string;
	createdAt: string;
	actorUserId: string | null;
}

export type WorkspaceRealtimeEvent =
	| (WorkspaceRealtimeEventBase & {
			type: "workspace.item.created" | "workspace.item.renamed";
			payload: { itemId: string };
	  })
	| (WorkspaceRealtimeEventBase & {
			type: "workspace.item.moved";
			payload: {
				itemId: string;
				parentId: string | null;
				sortOrder?: number;
			};
	  })
	| (WorkspaceRealtimeEventBase & {
			type: "workspace.item.deleted";
			payload: { itemId: string };
	  })
	| (WorkspaceRealtimeEventBase & {
			type: "workspace.item.content.updated";
			payload: { itemId: string };
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
