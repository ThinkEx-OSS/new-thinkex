import handler from "@tanstack/react-start/server-entry";
import { routePartykitRequest } from "partyserver";

import { routeWorkspaceChatRequest } from "#/features/workspaces/ai/auth";
import { authenticateWorkspaceRealtimeRequest } from "#/features/workspaces/realtime/auth";
import { workspaceRealtimePrefix } from "#/features/workspaces/realtime/messages";

export {
	WorkspaceChatAgent,
	WorkspaceChatDirectory,
} from "#/features/workspaces/ai/workspace-chat-agent";
export { WorkspaceRoom } from "#/features/workspaces/realtime/workspace-room";

const isProduction = import.meta.env.PROD;

const productionCsp = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"frame-src 'none'",
	"form-action 'self'",
	"manifest-src 'self'",
	"img-src 'self' data: blob: https:",
	"font-src 'self' https://fonts.gstatic.com data:",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"script-src 'self' 'unsafe-inline'",
	"connect-src 'self' wss: https://us.i.posthog.com",
	"media-src 'self' data: blob:",
	"worker-src 'self' blob:",
].join("; ");

const developmentCsp = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"frame-src 'none'",
	"form-action 'self'",
	"manifest-src 'self'",
	"img-src 'self' data: blob: https:",
	"font-src 'self' https://fonts.gstatic.com data:",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
	"connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:*",
	"media-src 'self' data: blob:",
	"worker-src 'self' blob:",
].join("; ");

function isHtmlResponse(response: Response) {
	return response.headers.get("content-type")?.includes("text/html") ?? false;
}

function withSecurityHeaders(response: Response) {
	if (!isHtmlResponse(response)) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.set(
		"Content-Security-Policy",
		isProduction ? productionCsp : developmentCsp,
	);
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	headers.set("X-Frame-Options", "DENY");
	headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

	if (isProduction) {
		headers.set(
			"Strict-Transport-Security",
			"max-age=63072000; includeSubDomains; preload",
		);
	}

	return new Response(response.body, {
		headers,
		status: response.status,
		statusText: response.statusText,
	});
}

export default {
	async fetch(request, env) {
		const chatResponse = await routeWorkspaceChatRequest(request, env);

		if (chatResponse) {
			return chatResponse;
		}

		const realtimeResponse = await routePartykitRequest(request, env, {
			prefix: workspaceRealtimePrefix,
			onBeforeConnect: authenticateWorkspaceRealtimeRequest,
			onBeforeRequest: authenticateWorkspaceRealtimeRequest,
		});

		return withSecurityHeaders(
			realtimeResponse ?? (await handler.fetch(request)),
		);
	},
} satisfies ExportedHandler<Env>;
