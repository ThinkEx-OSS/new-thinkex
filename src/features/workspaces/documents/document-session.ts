import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import {
	Awareness,
	applyAwarenessUpdate,
	encodeAwarenessUpdate,
	removeAwarenessStates,
} from "y-protocols/awareness";
import { readSyncMessage, writeSyncStep1, writeUpdate } from "y-protocols/sync";
import * as Y from "yjs";

import {
	type DocumentSessionRouteParams,
	getDocumentSessionRouteParams,
} from "#/features/workspaces/agent-routes";
import {
	parseTiptapDocumentJson,
	stringifyTiptapDocumentJson,
	tiptapDocumentJsonSchema,
} from "#/features/workspaces/documents/tiptap-document";
import {
	getTiptapDocumentSchema,
	tiptapDocumentYjsField,
} from "#/features/workspaces/documents/tiptap-schema";

const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;
const persistedYDocUpdateKey = "document-session:yjs-update";
const checkpointDelayMs = 2_000;

type DocumentSessionWebSocket = WebSocket;

interface WorkspaceKernelClient {
	readItem(input: { itemId: string }): Promise<{
		item: { type: string };
		content: string | null;
	}>;
	writeItem(input: {
		itemId: string;
		content: string;
		actorUserId?: string | null;
		clientMutationId?: string | null;
	}): Promise<unknown>;
}

interface WorkspaceKernelNamespace {
	getByName(name: string): WorkspaceKernelClient;
}

export class DocumentSession implements DurableObject {
	private readonly doc = new Y.Doc();
	private readonly awareness = new Awareness(this.doc);
	private checkpointTimer: ReturnType<typeof setTimeout> | null = null;
	private initialized: Promise<void> | null = null;
	private room: DocumentSessionRouteParams | null = null;
	private readonly socketAwarenessClients = new WeakMap<
		DocumentSessionWebSocket,
		Set<number>
	>();

	constructor(
		private readonly ctx: DurableObjectState,
		private readonly env: Env,
	) {
		this.doc.on("update", (update: Uint8Array, origin: unknown) => {
			this.broadcastSyncUpdate(update, origin);
			this.scheduleCheckpoint();
		});
		this.awareness.on(
			"update",
			(
				changes: {
					added: number[];
					updated: number[];
					removed: number[];
				},
				origin: unknown,
			) => {
				const changedClients = [
					...changes.added,
					...changes.updated,
					...changes.removed,
				];

				if (origin instanceof WebSocket) {
					const socketClients =
						this.socketAwarenessClients.get(origin) ?? new Set<number>();
					for (const clientId of [...changes.added, ...changes.updated]) {
						socketClients.add(clientId);
					}
					for (const clientId of changes.removed) {
						socketClients.delete(clientId);
					}
					this.socketAwarenessClients.set(origin, socketClients);
				}

				this.broadcastAwarenessUpdate(changedClients, origin);
			},
		);
	}

	async fetch(request: Request) {
		const params = getDocumentSessionRequestParams(request);

		if (!params) {
			return new Response("Document session not found", { status: 404 });
		}

		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("Expected websocket upgrade", { status: 426 });
		}

		if (!this.setRoom(params)) {
			return new Response("Document session room mismatch", { status: 409 });
		}

		await this.ensureInitialized(params);

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		server.serializeAttachment(params);
		this.ctx.acceptWebSocket(server);
		this.sendSyncStep(server);
		this.sendAwarenessSnapshot(server);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	async webSocketMessage(
		socket: DocumentSessionWebSocket,
		message: ArrayBuffer | string,
	) {
		if (typeof message === "string") {
			return;
		}

		await this.ensureInitialized(getSocketRoom(socket));
		this.handleYjsMessage(socket, new Uint8Array(message));
	}

	webSocketClose(socket: DocumentSessionWebSocket) {
		this.removeSocketAwareness(socket);
	}

	webSocketError(socket: DocumentSessionWebSocket) {
		this.removeSocketAwareness(socket);
	}

	private ensureInitialized(room: DocumentSessionRouteParams) {
		if (!this.setRoom(room)) {
			throw new Error("Document session room mismatch.");
		}

		this.initialized ??= this.initializeDocument(room);
		return this.initialized;
	}

	private async initializeDocument(room: DocumentSessionRouteParams) {
		const kernel = this.getWorkspaceKernel(room.workspaceId);
		const { item, content } = await kernel.readItem({ itemId: room.itemId });

		if (item.type !== "document") {
			throw new Error("Document session can only open document items.");
		}

		const persistedUpdate = await this.ctx.storage.get<Uint8Array>(
			persistedYDocUpdateKey,
		);

		if (persistedUpdate) {
			Y.applyUpdate(this.doc, persistedUpdate, this);
			return;
		}

		const snapshot = parseTiptapDocumentJson(content);
		const seededDoc = prosemirrorJSONToYDoc(
			getTiptapDocumentSchema(),
			snapshot,
			tiptapDocumentYjsField,
		);
		Y.applyUpdate(this.doc, Y.encodeStateAsUpdate(seededDoc), this);
		seededDoc.destroy();
		await this.persistYDoc();
	}

	private handleYjsMessage(
		socket: DocumentSessionWebSocket,
		message: Uint8Array,
	) {
		const decoder = decoding.createDecoder(message);
		const messageType = decoding.readVarUint(decoder);

		switch (messageType) {
			case messageSync: {
				const encoder = encoding.createEncoder();
				encoding.writeVarUint(encoder, messageSync);
				readSyncMessage(decoder, encoder, this.doc, socket);

				if (encoding.length(encoder) > 1) {
					socket.send(encoding.toUint8Array(encoder));
				}
				break;
			}
			case messageAwareness:
				applyAwarenessUpdate(
					this.awareness,
					decoding.readVarUint8Array(decoder),
					socket,
				);
				break;
			case messageQueryAwareness:
				this.sendAwarenessSnapshot(socket);
				break;
		}
	}

	private sendSyncStep(socket: DocumentSessionWebSocket) {
		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, messageSync);
		writeSyncStep1(encoder, this.doc);
		socket.send(encoding.toUint8Array(encoder));
	}

	private sendAwarenessSnapshot(socket: DocumentSessionWebSocket) {
		const clientIds = Array.from(this.awareness.getStates().keys());

		if (clientIds.length === 0) {
			return;
		}

		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, messageAwareness);
		encoding.writeVarUint8Array(
			encoder,
			encodeAwarenessUpdate(this.awareness, clientIds),
		);
		socket.send(encoding.toUint8Array(encoder));
	}

	private broadcastSyncUpdate(update: Uint8Array, origin: unknown) {
		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, messageSync);
		writeUpdate(encoder, update);
		this.broadcastYjsMessage(encoding.toUint8Array(encoder), origin);
	}

	private broadcastAwarenessUpdate(clientIds: number[], origin: unknown) {
		if (clientIds.length === 0) {
			return;
		}

		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, messageAwareness);
		encoding.writeVarUint8Array(
			encoder,
			encodeAwarenessUpdate(this.awareness, clientIds),
		);
		this.broadcastYjsMessage(encoding.toUint8Array(encoder), origin);
	}

	private broadcastYjsMessage(message: Uint8Array, origin: unknown) {
		for (const socket of this.ctx.getWebSockets()) {
			if (socket !== origin) {
				socket.send(message);
			}
		}
	}

	private removeSocketAwareness(socket: DocumentSessionWebSocket) {
		const clientIds = this.socketAwarenessClients.get(socket);

		if (!clientIds || clientIds.size === 0) {
			return;
		}

		removeAwarenessStates(this.awareness, Array.from(clientIds), this);
		this.socketAwarenessClients.delete(socket);
	}

	private scheduleCheckpoint() {
		if (this.checkpointTimer) {
			clearTimeout(this.checkpointTimer);
		}

		this.checkpointTimer = setTimeout(() => {
			this.checkpointTimer = null;
			void this.checkpointDocument().catch((error: unknown) => {
				console.error("Document session checkpoint failed", error);
			});
		}, checkpointDelayMs);
	}

	private async checkpointDocument() {
		const room = this.requireRoom();

		await this.persistYDoc();

		const document = tiptapDocumentJsonSchema.parse(
			yDocToProsemirrorJSON(this.doc, tiptapDocumentYjsField),
		);
		const kernel = this.getWorkspaceKernel(room.workspaceId);

		await kernel.writeItem({
			itemId: room.itemId,
			content: stringifyTiptapDocumentJson(document),
			actorUserId: null,
			clientMutationId: null,
		});
	}

	private async persistYDoc() {
		await this.ctx.storage.put(
			persistedYDocUpdateKey,
			Y.encodeStateAsUpdate(this.doc),
		);
	}

	private getWorkspaceKernel(workspaceId: string): WorkspaceKernelClient {
		// Keep this DO decoupled from the generated WorkspaceKernel RPC type,
		// which is too deep for tsgo to instantiate through Env.
		const namespace = this.env
			.WorkspaceKernel as unknown as WorkspaceKernelNamespace;
		return namespace.getByName(workspaceId);
	}

	private setRoom(room: DocumentSessionRouteParams) {
		if (!this.room) {
			this.room = room;
			return true;
		}

		return (
			this.room.workspaceId === room.workspaceId &&
			this.room.itemId === room.itemId
		);
	}

	private requireRoom() {
		if (!this.room) {
			throw new Error("Document session room is missing.");
		}

		return this.room;
	}
}

function getDocumentSessionRequestParams(request: Request) {
	const url = new URL(request.url);
	return getDocumentSessionRouteParams(url.pathname);
}

function getSocketRoom(socket: DocumentSessionWebSocket) {
	const attachment = socket.deserializeAttachment();

	if (isDocumentSessionRouteParams(attachment)) {
		return attachment;
	}

	throw new Error("Document session socket attachment is missing.");
}

function isDocumentSessionRouteParams(
	value: unknown,
): value is DocumentSessionRouteParams {
	return (
		typeof value === "object" &&
		value !== null &&
		"workspaceId" in value &&
		"itemId" in value &&
		typeof value.workspaceId === "string" &&
		typeof value.itemId === "string"
	);
}
