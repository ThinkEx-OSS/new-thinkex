import handler from "@tanstack/react-start/server-entry";

import { routeUserAIRequest } from "#/features/workspaces/ai/auth";
import { routeDocumentSessionRequest } from "#/features/workspaces/documents/document-session-auth";
import { routeWorkspaceKernelRequest } from "#/features/workspaces/kernel/workspace-kernel-auth";

export {
	AIThread,
	UserAIStore,
} from "#/features/workspaces/ai/user-ai-agents";
export { DocumentSession } from "#/features/workspaces/documents/document-session";
export { WorkspaceFileExtractionWorkflow } from "#/features/workspaces/extraction/workspace-file-extraction-workflow";
export { WorkspaceKernel } from "#/features/workspaces/kernel/workspace-kernel";

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
		const chatResponse = await routeUserAIRequest(request, env);

		if (chatResponse) {
			return chatResponse;
		}

		const documentSessionResponse = await routeDocumentSessionRequest(
			request,
			env,
		);

		if (documentSessionResponse) {
			return documentSessionResponse;
		}

		const workspaceKernelResponse = await routeWorkspaceKernelRequest(
			request,
			env,
		);

		return withSecurityHeaders(
			workspaceKernelResponse ?? (await handler.fetch(request)),
		);
	},
} satisfies ExportedHandler<Env>;
