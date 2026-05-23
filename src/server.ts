import handler from "@tanstack/react-start/server-entry";
import { routePartykitRequest } from "partyserver";

import { authenticateWorkspaceRealtimeRequest } from "#/features/workspaces/realtime/auth";
import { workspaceRealtimePrefix } from "#/features/workspaces/realtime/messages";

export { WorkspaceRoom } from "#/features/workspaces/realtime/workspace-room";

export default {
	async fetch(request, env) {
		const realtimeResponse = await routePartykitRequest(request, env, {
			prefix: workspaceRealtimePrefix,
			onBeforeConnect: authenticateWorkspaceRealtimeRequest,
			onBeforeRequest: authenticateWorkspaceRealtimeRequest,
		});

		return realtimeResponse ?? handler.fetch(request);
	},
} satisfies ExportedHandler<Env>;
