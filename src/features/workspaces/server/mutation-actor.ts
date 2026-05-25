import type {
	JsonValue,
	WorkspaceMutationActor,
	WorkspaceMutationActorType,
} from "#/features/workspaces/contracts";
import { getCurrentUserId } from "#/features/workspaces/server/permissions";

export interface WorkspaceMutationActorInput {
	userId: string;
	type?: WorkspaceMutationActorType;
	operationId?: string;
	agentSessionId?: string;
	operationMetadata?: Record<string, JsonValue>;
}

export function createWorkspaceMutationActor({
	userId,
	type = "user",
	operationId,
	agentSessionId,
	operationMetadata,
}: WorkspaceMutationActorInput): WorkspaceMutationActor {
	return {
		type,
		userId,
		...(agentSessionId ? { agentSessionId } : {}),
		operation: {
			id: operationId ?? crypto.randomUUID(),
			...(operationMetadata ? { metadata: operationMetadata } : {}),
		},
	};
}

export async function getCurrentUserWorkspaceMutationActor(
	input: Omit<WorkspaceMutationActorInput, "userId"> = {},
) {
	const userId = await getCurrentUserId();

	return createWorkspaceMutationActor({
		...input,
		userId,
	});
}
