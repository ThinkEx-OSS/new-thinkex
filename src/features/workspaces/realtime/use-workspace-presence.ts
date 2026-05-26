import { useEffect, useMemo, useRef, useState } from "react";

import {
	type WorkspacePresenceUser,
	type WorkspaceRealtimeEvent,
	type WorkspaceRealtimeServerMessage,
	workspaceKernelRealtimePathPrefix,
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

function getWorkspaceKernelRealtimeUrl(workspaceId: string) {
	const url = new URL(
		`${workspaceKernelRealtimePathPrefix}/${encodeURIComponent(
			workspaceId,
		)}/realtime`,
		window.location.href,
	);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

	return url;
}

export function useWorkspaceRealtime({
	workspaceId,
	onEvent,
	onReconnect,
}: UseWorkspaceRealtimeInput) {
	const [users, setUsers] = useState<WorkspacePresenceUser[]>([]);
	const [status, setStatus] = useState<ConnectionStatus>("connecting");
	const hasConnectedRef = useRef(false);
	const onEventRef = useRef(onEvent);
	const onReconnectRef = useRef(onReconnect);

	useEffect(() => {
		onEventRef.current = onEvent;
		onReconnectRef.current = onReconnect;
	}, [onEvent, onReconnect]);

	useEffect(() => {
		let closedByHook = false;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let retryCount = 0;
		let socket: WebSocket | null = null;

		function connect() {
			setStatus("connecting");
			socket = new WebSocket(getWorkspaceKernelRealtimeUrl(workspaceId));

			socket.addEventListener("open", () => {
				retryCount = 0;
				setStatus("connected");

				if (hasConnectedRef.current) {
					onReconnectRef.current?.();
				}

				hasConnectedRef.current = true;
			});

			socket.addEventListener("close", () => {
				setStatus("disconnected");
				setUsers([]);

				if (closedByHook) {
					return;
				}

				const delay = Math.min(1000 * 2 ** retryCount, 10_000);
				retryCount += 1;
				reconnectTimer = setTimeout(connect, delay);
			});

			socket.addEventListener("error", () => {
				setStatus("disconnected");
			});

			socket.addEventListener("message", (event) => {
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
					onEventRef.current?.(message.event);
				}
			});
		}

		connect();

		return () => {
			closedByHook = true;

			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
			}

			socket?.close();
			setStatus("disconnected");
			setUsers([]);
		};
	}, [workspaceId]);

	return useMemo(
		() => ({
			users,
			status,
		}),
		[status, users],
	);
}
