import { getServerByName } from "partyserver";

import type { WorkspaceRealtimeEvent } from "#/features/workspaces/realtime/messages";

async function getCloudflareWorkersModule() {
	try {
		return await import("cloudflare:workers");
	} catch {
		return null;
	}
}

export async function scheduleWorkspaceEventBroadcast(
	event: WorkspaceRealtimeEvent,
) {
	const workers = await getCloudflareWorkersModule();

	if (!workers) {
		return;
	}

	workers.waitUntil(
		broadcastWorkspaceEvent(workers.env.WorkspaceRoom, event).catch((error) => {
			console.error("Unable to broadcast workspace event.", error);
		}),
	);
}

async function broadcastWorkspaceEvent(
	namespace: Env["WorkspaceRoom"],
	event: WorkspaceRealtimeEvent,
) {
	const room = await getServerByName(namespace, event.workspaceId);
	await room.broadcastWorkspaceEvent({
		type: "workspace.event",
		workspaceId: event.workspaceId,
		event,
	});
}
