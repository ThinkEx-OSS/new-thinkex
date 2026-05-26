import { getAgentByName } from "agents";

import { getSessionFromRequest } from "#/lib/auth-queries.server";

const workspaceChatPath = "/workspace-chat";

export async function routeWorkspaceChatRequest(request: Request, env: Env) {
	const url = new URL(request.url);

	if (
		url.pathname !== workspaceChatPath &&
		!url.pathname.startsWith(`${workspaceChatPath}/`)
	) {
		return null;
	}

	try {
		const session = await getSessionFromRequest(request);

		if (!session?.user) {
			return new Response("Unauthorized", { status: 401 });
		}

		const directory = await getAgentByName(
			env.WorkspaceChatDirectory,
			session.user.id,
		);

		return directory.fetch(request);
	} catch (error) {
		console.error("Workspace chat auth failed", error);
		return new Response("Chat unavailable", { status: 503 });
	}
}
