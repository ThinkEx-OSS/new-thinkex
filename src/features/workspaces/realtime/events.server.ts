import { workspaceEvents } from "#/db/schema";
import type { createDbContext } from "#/db/server";
import type { WorkspaceMutationActor } from "#/features/workspaces/contracts";
import type { WorkspaceRealtimeEvent } from "#/features/workspaces/realtime/messages";

type WorkspaceDb = Awaited<ReturnType<typeof createDbContext>>["db"];
export type WorkspaceTransaction = Parameters<
	Parameters<WorkspaceDb["transaction"]>[0]
>[0];

type WorkspaceRealtimeEventForType<
	TType extends WorkspaceRealtimeEvent["type"],
> = Omit<WorkspaceRealtimeEvent, "type" | "payload"> & {
	type: TType;
	payload: WorkspaceRealtimeEventPayload<TType>;
};

type WorkspaceRealtimeEventPayload<
	TType extends WorkspaceRealtimeEvent["type"],
> = WorkspaceRealtimeEvent extends infer TEvent
	? TEvent extends { type: infer TEventType; payload: infer TPayload }
		? TType extends TEventType
			? TPayload
			: never
		: never
	: never;

export async function insertWorkspaceRealtimeEvent<
	const TType extends WorkspaceRealtimeEvent["type"],
>(
	tx: WorkspaceTransaction,
	input: {
		workspaceId: string;
		itemId: string;
		actor: WorkspaceMutationActor;
		type: TType;
		payload: WorkspaceRealtimeEventPayload<TType>;
	},
): Promise<WorkspaceRealtimeEventForType<TType>> {
	const payloadJson = {
		...input.payload,
		operation: input.actor.operation,
	};
	const [event] = await tx
		.insert(workspaceEvents)
		.values({
			id: crypto.randomUUID(),
			workspaceId: input.workspaceId,
			itemId: input.itemId,
			actorType: input.actor.type,
			actorUserId: input.actor.userId,
			actorAgentSessionId: input.actor.agentSessionId,
			eventType: input.type,
			payloadJson,
		})
		.returning({
			id: workspaceEvents.id,
			createdAt: workspaceEvents.createdAt,
		});

	if (!event) {
		throw new Error("Workspace event was not created.");
	}

	return {
		id: event.id,
		type: input.type,
		workspaceId: input.workspaceId,
		itemId: input.itemId,
		actorType: input.actor.type,
		actorUserId: input.actor.userId,
		actorAgentSessionId: input.actor.agentSessionId ?? null,
		createdAt: event.createdAt.toISOString(),
		operation: input.actor.operation,
		payload: input.payload,
	} as WorkspaceRealtimeEventForType<TType>;
}
