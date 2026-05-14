import { createFileRoute } from "@tanstack/react-router";

import { apiError, apiJson, getRequestId } from "#/lib/api/http";
import { getSessionFromRequest } from "#/lib/auth.functions";
import { listMockWorkspaces } from "#/services/workspaces";

async function handleListWorkspaces(request: Request) {
	const requestId = getRequestId(request);

	try {
		const session = await getSessionFromRequest(request);

		if (!session) {
			return apiError(
				requestId,
				401,
				"UNAUTHORIZED",
				"You must be signed in to view workspaces.",
			);
		}

		return apiJson({ workspaces: listMockWorkspaces() }, requestId);
	} catch (error) {
		return apiError(
			requestId,
			500,
			"INTERNAL_ERROR",
			"Unable to load workspaces right now.",
			error instanceof Error ? { message: error.message } : undefined,
		);
	}
}

export const Route = createFileRoute("/api/v1/workspaces")({
	server: {
		handlers: {
			GET: ({ request }) => handleListWorkspaces(request),
		},
	},
});

export { handleListWorkspaces };
