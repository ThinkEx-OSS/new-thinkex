import { usePartySocket } from "partysocket/react";
import { useMemo, useState } from "react";

import {
	type WorkspacePresenceUser,
	type WorkspaceRealtimeServerMessage,
	workspaceRealtimeParty,
	workspaceRealtimePrefix,
} from "./messages";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

function parseServerMessage(data: unknown) {
	if (typeof data !== "string") {
		return null;
	}

	try {
		return JSON.parse(data) as WorkspaceRealtimeServerMessage;
	} catch {
		return null;
	}
}

export function useWorkspacePresence(workspaceId: string) {
	const [users, setUsers] = useState<WorkspacePresenceUser[]>([]);
	const [status, setStatus] = useState<ConnectionStatus>("connecting");

	usePartySocket({
		prefix: workspaceRealtimePrefix,
		party: workspaceRealtimeParty,
		room: workspaceId,
		onOpen() {
			setStatus("connected");
		},
		onClose() {
			setStatus("disconnected");
			setUsers([]);
		},
		onError() {
			setStatus("disconnected");
		},
		onMessage(event) {
			const message = parseServerMessage(event.data);

			if (
				message?.type === "presence.snapshot" &&
				message.workspaceId === workspaceId
			) {
				setUsers(message.users);
			}
		},
	});

	return useMemo(
		() => ({
			users,
			status,
		}),
		[status, users],
	);
}
