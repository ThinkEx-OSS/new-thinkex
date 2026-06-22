import { getAgentByName } from "agents";

import { userAIAgentName } from "#/features/workspaces/agent-routes";
import type { UserAIStore } from "#/features/workspaces/ai/user-ai-agents";

export async function ensureWorkspaceStarterThreadForUser(input: {
	userId: string;
	workspaceId: string;
}) {
	try {
		const { env } = await import("cloudflare:workers");
		const directory = (await getAgentByName(
			env[userAIAgentName],
			input.userId,
		)) as unknown as Pick<UserAIStore, "ensureWorkspaceStarterThread">;
		await directory.ensureWorkspaceStarterThread({
			workspaceId: input.workspaceId,
		});
	} catch (error) {
		// Workspace creation should survive AI directory failures; this helper is safe to retry.
		console.warn("[Workspaces] Failed to create starter chat thread", error);
	}
}
