import { useCallback, useRef } from "react";

import type { WorkspaceRealtimeEvent } from "#/features/workspaces/realtime/messages";

export const WORKSPACE_LOCAL_MUTATION_ECHO_TTL_MS = 30_000;

type WorkspaceClientMutationInput = {
	clientMutationId?: string;
};

const localClientMutationIds = new Set<string>();
const localClientMutationTimeouts = new Map<
	string,
	ReturnType<typeof setTimeout>
>();

export function trackWorkspaceClientMutationId(clientMutationId: string) {
	localClientMutationIds.add(clientMutationId);
	const existingTimeout = localClientMutationTimeouts.get(clientMutationId);

	if (existingTimeout) {
		clearTimeout(existingTimeout);
	}

	localClientMutationTimeouts.set(
		clientMutationId,
		setTimeout(() => {
			forgetWorkspaceClientMutationId(clientMutationId);
		}, WORKSPACE_LOCAL_MUTATION_ECHO_TTL_MS),
	);
}

export function forgetWorkspaceClientMutationId(clientMutationId: string) {
	localClientMutationIds.delete(clientMutationId);
	const existingTimeout = localClientMutationTimeouts.get(clientMutationId);

	if (existingTimeout) {
		clearTimeout(existingTimeout);
		localClientMutationTimeouts.delete(clientMutationId);
	}
}

export function shouldIgnoreWorkspaceClientMutationEcho(
	event: WorkspaceRealtimeEvent,
) {
	return Boolean(
		event.clientMutationId &&
			localClientMutationIds.has(event.clientMutationId),
	);
}

export function useWorkspaceClientMutationEcho<
	TInput extends object & WorkspaceClientMutationInput,
>() {
	const clientMutationIds = useRef(new WeakMap<TInput, string>());

	const getClientMutationId = useCallback(
		(input: TInput) =>
			clientMutationIds.current.get(input) ??
			input.clientMutationId ??
			crypto.randomUUID(),
		[],
	);
	const trackClientMutationId = useCallback(
		(input: TInput, clientMutationId: string) => {
			clientMutationIds.current.set(input, clientMutationId);
			trackWorkspaceClientMutationId(clientMutationId);
		},
		[],
	);
	const forgetClientMutationId = useCallback((clientMutationId: string) => {
		forgetWorkspaceClientMutationId(clientMutationId);
	}, []);
	const shouldIgnoreLocalEcho = useCallback(
		(event: WorkspaceRealtimeEvent) =>
			shouldIgnoreWorkspaceClientMutationEcho(event),
		[],
	);

	return {
		forgetClientMutationId,
		getClientMutationId,
		shouldIgnoreLocalEcho,
		trackClientMutationId,
	};
}
