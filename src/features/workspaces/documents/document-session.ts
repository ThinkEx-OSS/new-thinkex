import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

import type { DocumentSessionRouteParams } from "#/features/workspaces/agent-routes";
import {
	parseTiptapDocumentJson,
	stringifyTiptapDocumentJson,
	tiptapDocumentJsonSchema,
} from "#/features/workspaces/documents/tiptap-document";
import {
	getTiptapDocumentSchema,
	tiptapDocumentYjsField,
} from "#/features/workspaces/documents/tiptap-schema";

const persistedYDocUpdateKey = "document-session:yjs-update";
const checkpointDelayMs = 2_000;
const checkpointMaxWaitMs = 10_000;

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

export class DocumentSession extends YServer {
	static override options = {
		hibernate: true,
	};

	static override callbackOptions = {
		debounceWait: checkpointDelayMs,
		debounceMaxWait: checkpointMaxWaitMs,
	};

	override async onLoad() {
		const room = getDocumentSessionRoomNameParts(this.name);
		const kernel = this.getWorkspaceKernel(room.workspaceId);
		const { item, content } = await kernel.readItem({ itemId: room.itemId });

		if (item.type !== "document") {
			throw new Error("Document session can only open document items.");
		}

		const persistedUpdate = await this.ctx.storage.get<Uint8Array>(
			persistedYDocUpdateKey,
		);

		if (persistedUpdate) {
			Y.applyUpdate(this.document, persistedUpdate, this);
			return;
		}

		const snapshot = parseTiptapDocumentJson(content);
		const seededDoc = prosemirrorJSONToYDoc(
			getTiptapDocumentSchema(),
			snapshot,
			tiptapDocumentYjsField,
		);

		Y.applyUpdate(this.document, Y.encodeStateAsUpdate(seededDoc), this);
		seededDoc.destroy();
		await this.persistYDoc();
	}

	override async onSave() {
		const room = getDocumentSessionRoomNameParts(this.name);

		await this.persistYDoc();

		const document = tiptapDocumentJsonSchema.parse(
			yDocToProsemirrorJSON(this.document, tiptapDocumentYjsField),
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
			Y.encodeStateAsUpdate(this.document),
		);
	}

	private getWorkspaceKernel(workspaceId: string): WorkspaceKernelClient {
		// Keep this DO decoupled from the generated WorkspaceKernel RPC type,
		// which is too deep for tsgo to instantiate through Env.
		const namespace = this.env
			.WorkspaceKernel as unknown as WorkspaceKernelNamespace;
		return namespace.getByName(workspaceId);
	}
}

function getDocumentSessionRoomNameParts(
	roomName: string,
): DocumentSessionRouteParams {
	const separatorIndex = roomName.indexOf(":");

	if (separatorIndex <= 0 || separatorIndex === roomName.length - 1) {
		throw new Error("Document session room name is invalid.");
	}

	return {
		workspaceId: roomName.slice(0, separatorIndex),
		itemId: roomName.slice(separatorIndex + 1),
	};
}
