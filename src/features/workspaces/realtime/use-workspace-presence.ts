import { useAgent } from "agents/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
		if (!workspaceId) {
			return;
		}

		hasConnectedRef.current = false;
		setStatus("connecting");
		setUsers([]);
	}, [workspaceId]);

	const handleOpen = useCallback(() => {
		setStatus("connected");

		if (hasConnectedRef.current) {
			onReconnectRef.current?.();
		}

		hasConnectedRef.current = true;
	}, []);

	const handleClose = useCallback(() => {
		setStatus("disconnected");
		setUsers([]);
	}, []);

	const handleError = useCallback(() => {
		setStatus("disconnected");
	}, []);

	const handleMessage = useCallback(
		(event: MessageEvent) => {
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
		},
		[workspaceId],
	);

	useAgent({
		agent: "WorkspaceKernel",
		basePath: workspaceKernelRealtimePathPrefix.slice(1),
		path: `${workspaceId}/realtime`,
		onClose: handleClose,
		onError: handleError,
		onMessage: handleMessage,
		onOpen: handleOpen,
	});

	return useMemo(
		() => ({
			users,
			status,
		}),
		[status, users],
	);
}
