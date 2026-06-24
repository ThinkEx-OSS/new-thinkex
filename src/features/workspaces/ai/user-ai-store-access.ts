import { getAgentByName } from "agents";

import { userAIAgentName } from "#/features/workspaces/agent-routes";

export interface UserAIStoreClient {
	purgeForDeletion(): Promise<void>;
}

export function getUserAIStoreFromEnv(env: Env, userId: string): UserAIStoreClient {
	return getAgentByName(env[userAIAgentName], userId) as unknown as UserAIStoreClient;
}
