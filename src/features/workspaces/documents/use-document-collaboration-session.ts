import { useEffect, useState } from "react";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

import { getDocumentSessionBaseUrl } from "#/features/workspaces/agent-routes";

export type DocumentCollaborationStatus =
	| "connecting"
	| "connected"
	| "disconnected";

interface DocumentCollaborationUser {
	id: string;
	image?: string | null;
	name: string;
}

export interface DocumentCollaborationSession {
	itemId: string;
	provider: WebsocketProvider;
	ready: boolean;
	status: DocumentCollaborationStatus;
	workspaceId: string;
	ydoc: Y.Doc;
}

export function useDocumentCollaborationSession(input: {
	itemId: string;
	user: DocumentCollaborationUser | null;
	workspaceId: string;
}) {
	const [session, setSession] = useState<DocumentCollaborationSession | null>(
		null,
	);

	useEffect(() => {
		if (!input.user) {
			setSession(null);
			return;
		}

		const ydoc = new Y.Doc();
		const provider = new WebsocketProvider(
			getDocumentSessionBaseUrl(input.workspaceId),
			encodeURIComponent(input.itemId),
			ydoc,
			{
				disableBc: true,
				resyncInterval: 10_000,
			},
		);
		const user = getCollaborationUser(input.user);
		const updateSession = (patch: {
			ready?: boolean;
			status?: DocumentCollaborationStatus;
		}) => {
			setSession((current) => {
				const currentMatchesRoom =
					current?.workspaceId === input.workspaceId &&
					current.itemId === input.itemId &&
					current.provider === provider;

				return {
					itemId: input.itemId,
					provider,
					ready: (currentMatchesRoom && current.ready) || patch.ready || false,
					status:
						patch.status ??
						(currentMatchesRoom ? current.status : undefined) ??
						(provider.wsconnected ? "connected" : "connecting"),
					workspaceId: input.workspaceId,
					ydoc,
				};
			});
		};
		const handleStatus = (event: { status: DocumentCollaborationStatus }) => {
			updateSession({ status: event.status });
		};
		const handleSync = (synced: boolean) => {
			updateSession({ ready: synced });
		};

		provider.awareness.setLocalStateField("user", user);
		provider.on("status", handleStatus);
		provider.on("sync", handleSync);
		updateSession({
			ready: provider.synced,
			status: provider.wsconnected ? "connected" : "connecting",
		});

		return () => {
			provider.off("status", handleStatus);
			provider.off("sync", handleSync);
			provider.destroy();
			ydoc.destroy();
		};
	}, [input.itemId, input.user, input.workspaceId]);

	return session?.workspaceId === input.workspaceId &&
		session.itemId === input.itemId &&
		input.user &&
		session.ready
		? session
		: null;
}

function getCollaborationUser(user: DocumentCollaborationUser) {
	return {
		id: user.id,
		name: user.name || "User",
		image: user.image ?? null,
		color: getUserColor(user.id),
	};
}

function getUserColor(userId: string) {
	const colors = [
		"#2563eb",
		"#059669",
		"#dc2626",
		"#7c3aed",
		"#ca8a04",
		"#0891b2",
		"#be185d",
		"#4f46e5",
	];
	let hash = 0;

	for (const char of userId) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}

	return colors[hash % colors.length];
}
