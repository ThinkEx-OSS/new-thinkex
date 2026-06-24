import handler from "@tanstack/react-start/server-entry";

import { routeUserAIRequest } from "#/features/workspaces/ai/auth";
import { routeDocumentSessionRequest } from "#/features/workspaces/documents/document-session-auth";
import { routeWorkspaceKernelRequest } from "#/features/workspaces/kernel/workspace-kernel-auth";
import { posthogHostOrigin } from "#/integrations/posthog/config";
import { capturePostHogServerException } from "#/integrations/posthog/server";

export { CodemodeRuntime } from "@cloudflare/codemode";
export { AIThread, UserAIStore } from "#/features/workspaces/ai/user-ai-agents";
export { DocumentSession } from "#/features/workspaces/documents/document-session";
export { WorkspaceFileExtractionWorkflow } from "#/features/workspaces/extraction/workspace-file-extraction-workflow";
export { WorkspaceKernel } from "#/features/workspaces/kernel/workspace-kernel";

const isProduction = import.meta.env.PROD;

function buildContentSecurityPolicy() {
	const scriptSrc = ["'self'", "'unsafe-inline'"];
	const connectSrc = ["'self'", "wss:"];

	if (posthogHostOrigin) {
		scriptSrc.push(posthogHostOrigin);
		connectSrc.push(posthogHostOrigin);
	}

	if (!isProduction) {
		scriptSrc.push("'unsafe-eval'", "https://unpkg.com");
		connectSrc.push("ws:", "http://localhost:*", "http://127.0.0.1:*");
	}

	return [
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
		`script-src ${scriptSrc.join(" ")}`,
		`connect-src ${connectSrc.join(" ")}`,
		"media-src 'self' data: blob:",
		"worker-src 'self' blob:",
	].join("; ");
}

function isHtmlResponse(response: Response) {
	return response.headers.get("content-type")?.includes("text/html") ?? false;
}

function withSecurityHeaders(response: Response) {
	if (!isHtmlResponse(response)) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.set("Content-Security-Policy", buildContentSecurityPolicy());
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	headers.set("X-Frame-Options", "DENY");
	headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

	if (isProduction) {
		headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
	}

	return new Response(response.body, {
		headers,
		status: response.status,
		statusText: response.statusText,
	});
}

export default {
	async fetch(request, env) {
		try {
			const chatResponse = await routeUserAIRequest(request, env);

			if (chatResponse) {
				return chatResponse;
			}

			const documentSessionResponse = await routeDocumentSessionRequest(request, env);

			if (documentSessionResponse) {
				return documentSessionResponse;
			}

			const workspaceKernelResponse = await routeWorkspaceKernelRequest(request, env);

			return withSecurityHeaders(workspaceKernelResponse ?? (await handler.fetch(request)));
		} catch (error) {
			const url = new URL(request.url);

			capturePostHogServerException({
				error,
				properties: {
					handled_by: "worker.fetch",
				},
				request: {
					headers: request.headers,
					method: request.method,
					path: url.pathname,
					source: "worker.fetch",
					url: request.url,
				},
			});

			throw error;
		}
	},
} satisfies ExportedHandler<Env>;
