import type { ToolSet } from "ai";
import { tool } from "ai";
import { z } from "zod";

import {
	type BrowserQuickActionBinding,
	normalizeBrowserQuickActionResult,
} from "#/features/workspaces/ai/browser-quick-action";
import { assertPublicHttpUrl } from "#/features/workspaces/ai/web-access-policy";
import {
	isRedirect,
	isTextLikeContentType,
	readResponseText,
	responseMetadata,
} from "#/features/workspaces/ai/web-response";

const DEFAULT_FETCH_MAX_BYTES = 200_000;
const MAX_FETCH_BYTES = 512_000;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 8_000;

const readUrlInputSchema = z.object({
	maxBytes: z
		.number()
		.int()
		.min(1_000)
		.max(MAX_FETCH_BYTES)
		.optional()
		.describe("Maximum response bytes to read. Defaults to 200000."),
	url: z
		.url()
		.describe("Public HTTP(S) URL to fetch with a direct network request."),
});

const browserReadActionSchema = z.enum(["markdown", "content", "links"]);

const readWebPageInputSchema = z.object({
	action: browserReadActionSchema
		.optional()
		.describe(
			"Browser read mode. markdown is best for normal reading; content returns HTML; links returns page links.",
		),
	url: z
		.url()
		.describe("Public HTTP(S) URL to load in Cloudflare Browser Run."),
});

export function createAIThreadWebTools(env: Env): ToolSet {
	return {
		web_fetch_url: tool({
			description:
				"Fetch a public URL with a direct network request. Best for APIs, feeds, raw files, static text, and simple HTML.",
			inputSchema: readUrlInputSchema,
			execute: async ({ maxBytes, url }) => {
				return readPublicUrl(url, maxBytes ?? DEFAULT_FETCH_MAX_BYTES);
			},
		}),
		web_read_page: tool({
			description:
				"Read a public webpage with Cloudflare Browser Run. Best for rendered pages, JavaScript-heavy pages, markdown conversion, or final DOM links.",
			inputSchema: readWebPageInputSchema,
			execute: async ({ action = "markdown", url }) => {
				const safeUrl = assertPublicHttpUrl(url);
				const browser = env.BROWSER as unknown as BrowserQuickActionBinding;
				const result = await browser.quickAction(action, {
					url: safeUrl.toString(),
				});

				return normalizeBrowserQuickActionResult(action, result);
			},
		}),
	};
}

async function readPublicUrl(input: string, maxBytes: number) {
	let currentUrl = assertPublicHttpUrl(input);

	for (
		let redirectCount = 0;
		redirectCount <= MAX_REDIRECTS;
		redirectCount += 1
	) {
		const response = await fetch(currentUrl, {
			headers: {
				accept:
					"text/html,text/plain,application/json,application/xml,application/rss+xml,application/atom+xml;q=0.9,*/*;q=0.1",
				"user-agent": "ThinkExBot/0.1 (+https://thinkex.app)",
			},
			redirect: "manual",
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});

		if (isRedirect(response.status)) {
			const location = response.headers.get("location");

			if (!location) {
				return {
					kind: "error",
					metadata: responseMetadata(response, currentUrl),
					error: "Redirect response did not include a Location header.",
				};
			}

			currentUrl = assertPublicHttpUrl(
				new URL(location, currentUrl).toString(),
			);
			continue;
		}

		const contentType = response.headers.get("content-type") ?? "";

		if (!isTextLikeContentType(contentType)) {
			return {
				kind: "unsupported_content_type",
				metadata: responseMetadata(response, currentUrl),
				error:
					"Response is not a supported text-like content type. Use web_read_page for rendered pages or a future asset import tool for binary content.",
			};
		}

		const body = await readResponseText(response, maxBytes);

		return {
			kind: "text",
			metadata: responseMetadata(response, currentUrl),
			truncated: body.truncated,
			text: body.text,
		};
	}

	throw new Error(`Too many redirects. Limit is ${MAX_REDIRECTS}.`);
}
