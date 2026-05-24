import { usePartySocket } from "partysocket/react";
import { useMemo, useRef, useState } from "react";

import {
	type WorkspacePresenceUser,
	type WorkspaceRealtimeEvent,
	type WorkspaceRealtimeServerMessage,
	workspaceRealtimeParty,
	workspaceRealtimePrefix,
} from "./messages";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseWorkspaceRealtimeInput {
	workspaceId: string;
	onEvent?: (event: WorkspaceRealtimeEvent) => void;
	onReconnect?: () => void;
}

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

export function useWorkspaceRealtime({
	workspaceId,
	onEvent,
	onReconnect,
}: UseWorkspaceRealtimeInput) {
	const [users, setUsers] = useState<WorkspacePresenceUser[]>([]);
	const [status, setStatus] = useState<ConnectionStatus>("connecting");
	const hasConnectedRef = useRef(false);

	usePartySocket({
		prefix: workspaceRealtimePrefix,
		party: workspaceRealtimeParty,
		room: workspaceId,
		onOpen() {
			setStatus("connected");

			if (hasConnectedRef.current) {
				onReconnect?.();
			}

			hasConnectedRef.current = true;
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

			if (
				message?.type === "workspace.event" &&
				message.workspaceId === workspaceId
			) {
				onEvent?.(message.event);
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
