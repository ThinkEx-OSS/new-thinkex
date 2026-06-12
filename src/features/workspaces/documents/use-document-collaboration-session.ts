import { useEffect, useState } from "react";
import { WebsocketProvider } from "y-partyserver/provider";
import * as Y from "yjs";

import { getDocumentSessionBaseUrl } from "#/features/workspaces/agent-routes";

const idleDestroyDelayMs = 300_000;
const maxIdleSessions = 8;

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

interface CachedDocumentCollaborationSession
	extends DocumentCollaborationSession {
	destroy(): void;
	destroyTimer: ReturnType<typeof setTimeout> | null;
	key: string;
	lastUsedAt: number;
	refs: number;
	subscribe(listener: () => void): () => void;
	subscribers: Set<() => void>;
}

const documentSessionCache = new Map<
	string,
	CachedDocumentCollaborationSession
>();

export function useDocumentCollaborationSession(input: {
	itemId: string;
	user: DocumentCollaborationUser | null;
	workspaceId: string;
}) {
	const [session, setSession] = useState<DocumentCollaborationSession | null>(
		null,
	);
	const { itemId, user, workspaceId } = input;

	useEffect(() => {
		if (!user) {
			setSession(null);
			return;
		}

		const cachedSession = acquireDocumentSession({ itemId, user, workspaceId });
		const updateSession = () => {
			setSession(cachedSession.ready ? getPublicSession(cachedSession) : null);
		};
		const unsubscribe = cachedSession.subscribe(updateSession);

		updateSession();

		return () => {
			unsubscribe();
			releaseDocumentSession(cachedSession);
		};
	}, [itemId, user, workspaceId]);

	return session?.workspaceId === input.workspaceId &&
		session.itemId === input.itemId &&
		input.user &&
		session.ready
		? session
		: null;
}

function acquireDocumentSession(input: {
	itemId: string;
	user: DocumentCollaborationUser;
	workspaceId: string;
}) {
	const key = getDocumentSessionCacheKey(input);
	const cachedSession = documentSessionCache.get(key);

	if (cachedSession) {
		cachedSession.refs += 1;
		cachedSession.lastUsedAt = Date.now();
		if (cachedSession.destroyTimer) {
			clearTimeout(cachedSession.destroyTimer);
			cachedSession.destroyTimer = null;
		}
		cachedSession.provider.awareness.setLocalStateField(
			"user",
			getCollaborationUser(input.user),
		);
		return cachedSession;
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
	const session = createCachedDocumentSession({
		key,
		itemId: input.itemId,
		provider,
		workspaceId: input.workspaceId,
		ydoc,
	});

	provider.awareness.setLocalStateField(
		"user",
		getCollaborationUser(input.user),
	);
	documentSessionCache.set(key, session);
	pruneIdleDocumentSessions();

	return session;
}

function createCachedDocumentSession(input: {
	itemId: string;
	key: string;
	provider: WebsocketProvider;
	workspaceId: string;
	ydoc: Y.Doc;
}): CachedDocumentCollaborationSession {
	const session: CachedDocumentCollaborationSession = {
		destroy() {
			input.provider.off("status", handleStatus);
			input.provider.off("sync", handleSync);
			input.provider.destroy();
			input.ydoc.destroy();
			documentSessionCache.delete(input.key);
		},
		destroyTimer: null,
		itemId: input.itemId,
		key: input.key,
		lastUsedAt: Date.now(),
		provider: input.provider,
		ready: input.provider.synced,
		refs: 1,
		status: input.provider.wsconnected ? "connected" : "connecting",
		subscribe(listener: () => void) {
			session.subscribers.add(listener);
			return () => {
				session.subscribers.delete(listener);
			};
		},
		subscribers: new Set<() => void>(),
		workspaceId: input.workspaceId,
		ydoc: input.ydoc,
	};
	const handleStatus = (event: { status: DocumentCollaborationStatus }) => {
		session.status = event.status;
		notifyDocumentSessionSubscribers(session);
	};
	const handleSync = (synced: boolean) => {
		session.ready ||= synced;
		notifyDocumentSessionSubscribers(session);
	};

	input.provider.on("status", handleStatus);
	input.provider.on("sync", handleSync);

	return session;
}

function releaseDocumentSession(session: CachedDocumentCollaborationSession) {
	session.refs = Math.max(0, session.refs - 1);
	session.lastUsedAt = Date.now();

	if (session.refs > 0) {
		return;
	}

	session.provider.awareness.setLocalState(null);
	session.destroyTimer = setTimeout(() => {
		if (session.refs === 0) {
			session.destroy();
		}
	}, idleDestroyDelayMs);
}

function pruneIdleDocumentSessions() {
	const idleSessions = Array.from(documentSessionCache.values())
		.filter((session) => session.refs === 0)
		.sort((a, b) => a.lastUsedAt - b.lastUsedAt);

	while (documentSessionCache.size > maxIdleSessions && idleSessions.length) {
		idleSessions.shift()?.destroy();
	}
}

function notifyDocumentSessionSubscribers(
	session: Pick<CachedDocumentCollaborationSession, "subscribers">,
) {
	for (const subscriber of session.subscribers) {
		subscriber();
	}
}

function getPublicSession(
	session: CachedDocumentCollaborationSession,
): DocumentCollaborationSession {
	return {
		itemId: session.itemId,
		provider: session.provider,
		ready: session.ready,
		status: session.status,
		workspaceId: session.workspaceId,
		ydoc: session.ydoc,
	};
}

function getDocumentSessionCacheKey(input: {
	itemId: string;
	workspaceId: string;
}) {
	return `${input.workspaceId}:${input.itemId}`;
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
