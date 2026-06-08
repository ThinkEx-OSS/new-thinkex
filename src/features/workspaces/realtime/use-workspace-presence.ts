import { useAgent } from "agents/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
	getWorkspaceKernelRealtimePath,
	workspaceKernelAgentName,
	workspaceKernelBasePath,
} from "#/features/workspaces/agent-routes";
import type {
	WorkspacePresenceUser,
	WorkspaceRealtimeEvent,
	WorkspaceRealtimeServerMessage,
} from "./messages";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseWorkspaceRealtimeInput {
	workspaceId: string;
	lastSeenRevision?: number;
	onEvent?: (event: WorkspaceRealtimeEvent) => void;
	onReconnect?: () => void;
	onRevisionGap?: (event: WorkspaceRealtimeEvent) => void;
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
	lastSeenRevision,
	onEvent,
	onReconnect,
	onRevisionGap,
}: UseWorkspaceRealtimeInput) {
	const [users, setUsers] = useState<WorkspacePresenceUser[]>([]);
	const [status, setStatus] = useState<ConnectionStatus>("connecting");
	const hasConnectedRef = useRef(false);
	const lastSeenRevisionRef = useRef(lastSeenRevision ?? 0);
	const latestRevisionInputRef = useRef(lastSeenRevision ?? 0);
	const onEventRef = useRef(onEvent);
	const onReconnectRef = useRef(onReconnect);
	const onRevisionGapRef = useRef(onRevisionGap);

	useEffect(() => {
		onEventRef.current = onEvent;
		onReconnectRef.current = onReconnect;
		onRevisionGapRef.current = onRevisionGap;
	}, [onEvent, onReconnect, onRevisionGap]);

	useEffect(() => {
		if (!workspaceId) {
			return;
		}

		hasConnectedRef.current = false;
		lastSeenRevisionRef.current = latestRevisionInputRef.current;
		setStatus("connecting");
		setUsers([]);
	}, [workspaceId]);

	useEffect(() => {
		if (lastSeenRevision === undefined) {
			return;
		}

		latestRevisionInputRef.current = lastSeenRevision;
		lastSeenRevisionRef.current = Math.max(
			lastSeenRevisionRef.current,
			lastSeenRevision,
		);
	}, [lastSeenRevision]);

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
				const lastSeenRevision = lastSeenRevisionRef.current;

				if (
					lastSeenRevision > 0 &&
					message.event.revision > lastSeenRevision + 1
				) {
					onRevisionGapRef.current?.(message.event);
					lastSeenRevisionRef.current = message.event.revision;
					return;
				}

				lastSeenRevisionRef.current = Math.max(
					lastSeenRevisionRef.current,
					message.event.revision,
				);
				onEventRef.current?.(message.event);
			}
		},
		[workspaceId],
	);

	useAgent({
		agent: workspaceKernelAgentName,
		basePath: workspaceKernelBasePath,
		path: getWorkspaceKernelRealtimePath(workspaceId),
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
