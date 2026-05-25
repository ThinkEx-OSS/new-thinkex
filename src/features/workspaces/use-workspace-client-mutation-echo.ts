import { useCallback, useRef } from "react";

export const WORKSPACE_LOCAL_MUTATION_ECHO_TTL_MS = 30_000;

type WorkspaceClientMutationInput = {
	clientMutationId?: string;
};

export function useWorkspaceClientMutationEcho<
	TInput extends object & WorkspaceClientMutationInput,
>() {
	const clientMutationIds = useRef(new WeakMap<TInput, string>());
	const localClientMutationIds = useRef(new Set<string>());

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
			localClientMutationIds.current.add(clientMutationId);
		},
		[],
	);
	const forgetClientMutationId = useCallback((clientMutationId: string) => {
		localClientMutationIds.current.delete(clientMutationId);
	}, []);
	const shouldIgnoreLocalEcho = useCallback(
		(event: WorkspaceClientMutationInput) =>
			Boolean(
				event.clientMutationId &&
					localClientMutationIds.current.has(event.clientMutationId),
			),
		[],
	);

	return {
		forgetClientMutationId,
		getClientMutationId,
		shouldIgnoreLocalEcho,
		trackClientMutationId,
	};
}
