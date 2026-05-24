import { type Connection, type ConnectionContext, Server } from "partyserver";

import type {
	WorkspaceConnectionState,
	WorkspacePresenceUser,
	WorkspaceRealtimeServerMessage,
} from "./messages";

type WorkspaceEventMessage = Extract<
	WorkspaceRealtimeServerMessage,
	{ type: "workspace.event" }
>;

const USER_ID_HEADER = "x-thinkex-user-id";
const USER_NAME_HEADER = "x-thinkex-user-name";
const USER_IMAGE_HEADER = "x-thinkex-user-image";

export function setWorkspaceRoomUserHeaders(
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

export class WorkspaceRoom extends Server<Env> {
	static options = { hibernate: true };

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

	private broadcastPresenceSnapshot() {
		const message: WorkspaceRealtimeServerMessage = {
			type: "presence.snapshot",
			workspaceId: this.name,
			users: this.getPresenceUsers(),
		};

		this.broadcast(JSON.stringify(message));
	}

	broadcastWorkspaceEvent(message: WorkspaceEventMessage) {
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
