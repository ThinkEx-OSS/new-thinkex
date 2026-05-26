import { getAgentByName } from "agents";

import type { WorkspaceRealtimeEvent } from "#/features/workspaces/realtime/messages";

interface WorkspaceKernelBroadcaster {
	broadcastWorkspaceEvent(event: WorkspaceRealtimeEvent): Promise<void> | void;
}

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
		broadcastWorkspaceEvent(workers.env.WorkspaceKernel, event).catch(
			(error) => {
				console.error("Unable to broadcast workspace event.", error);
			},
		),
	);
}

async function broadcastWorkspaceEvent(
	namespace: Env["WorkspaceKernel"],
	event: WorkspaceRealtimeEvent,
) {
	const kernel = (await getAgentByName(
		namespace,
		event.workspaceId,
	)) as unknown as WorkspaceKernelBroadcaster;
	await kernel.broadcastWorkspaceEvent(event);
}
