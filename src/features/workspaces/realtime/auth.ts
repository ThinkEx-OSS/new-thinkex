import type { Lobby } from "partyserver";

import { createDbContext } from "#/db/server";
import type { WorkspacePresenceUser } from "#/features/workspaces/realtime/messages";
import { setWorkspaceRoomUserHeaders } from "#/features/workspaces/realtime/workspace-room";
import {
	canReadWorkspace,
	WorkspaceAuthError,
} from "#/features/workspaces/server/permissions";
import { getSessionFromRequest } from "#/lib/auth-queries.server";

export async function authenticateWorkspaceRealtimeRequest(
	request: Request,
	lobby: Lobby<Env>,
) {
	if (lobby.className !== "WorkspaceRoom") {
		return new Response("Not found", { status: 404 });
	}

	try {
		const session = await getSessionFromRequest(request);

		if (!session?.user) {
			return new Response("Unauthorized", { status: 401 });
		}

		const dbContext = await createDbContext();

		try {
			const canRead = await canReadWorkspace(dbContext.db, {
				workspaceId: lobby.name,
				userId: session.user.id,
			});

			if (!canRead) {
				return new Response("Forbidden", { status: 403 });
			}

			const user: Omit<WorkspacePresenceUser, "connectionId"> = {
				id: session.user.id,
				name: session.user.name,
				image: session.user.image ?? null,
			};

			return setWorkspaceRoomUserHeaders(request, user);
		} finally {
			await dbContext.dispose();
		}
	} catch (error) {
		if (error instanceof WorkspaceAuthError) {
			return new Response("Unauthorized", { status: 401 });
		}

		console.error("Workspace realtime auth failed", error);
		return new Response("Realtime unavailable", { status: 503 });
	}
}
