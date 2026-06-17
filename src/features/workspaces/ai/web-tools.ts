import {
	browserLinks,
	browserMarkdown,
	browserScrape,
	type QuickActionBinding,
} from "@cloudflare/think/tools/browser";
import type { ToolSet } from "ai";
import { tool } from "ai";
import { z } from "zod";

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
const MAX_BROWSER_RESULT_CHARS = 50_000;

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

const browserPageInputSchema = z.object({
	url: z
		.url()
		.describe("Public HTTP(S) URL to load in Cloudflare Browser Run."),
});

const browserScrapeInputSchema = browserPageInputSchema.extend({
	selectors: z
		.array(z.string())
		.min(1)
		.describe("CSS selectors to extract from the rendered page."),
});

export function createAIThreadWebTools(env: Env): ToolSet {
	const browser = env.BROWSER as unknown as QuickActionBinding;

	return {
		web_fetch_url: tool({
			description:
				"Fetch a public URL with a direct network request. Best for APIs, feeds, raw files, static text, and simple HTML.",
			inputSchema: readUrlInputSchema,
			execute: async ({ maxBytes, url }) => {
				return readPublicUrl(url, maxBytes ?? DEFAULT_FETCH_MAX_BYTES);
			},
		}),
		browser_markdown: tool({
			description:
				"Load a public webpage in Cloudflare Browser Run and return its rendered content as Markdown. Best for articles, docs, and JavaScript-heavy pages.",
			inputSchema: browserPageInputSchema,
			execute: async ({ url }) => {
				const safeUrl = assertPublicHttpUrl(url);
				return truncateText(
					await browserMarkdown(browser, {
						url: safeUrl.toString(),
					}),
				);
			},
		}),
		browser_links: tool({
			description:
				"Load a public webpage in Cloudflare Browser Run and return its rendered links.",
			inputSchema: browserPageInputSchema,
			execute: async ({ url }) => {
				const safeUrl = assertPublicHttpUrl(url);
				return boundJsonResult(
					await browserLinks(browser, {
						url: safeUrl.toString(),
					}),
				);
			},
		}),
		browser_scrape: tool({
			description:
				"Load a public webpage in Cloudflare Browser Run and scrape rendered elements by CSS selector.",
			inputSchema: browserScrapeInputSchema,
			execute: async ({ selectors, url }) => {
				const safeUrl = assertPublicHttpUrl(url);
				return boundJsonResult(
					await browserScrape(browser, {
						elements: selectors.map((selector) => ({ selector })),
						url: safeUrl.toString(),
					}),
				);
			},
		}),
	};
}

function truncateText(value: string) {
	if (value.length <= MAX_BROWSER_RESULT_CHARS) {
		return value;
	}

	return `${value.slice(0, MAX_BROWSER_RESULT_CHARS)}\n\n[truncated ${
		value.length - MAX_BROWSER_RESULT_CHARS
	} characters]`;
}

function boundJsonResult(value: unknown) {
	const json = JSON.stringify(value);

	if (json.length <= MAX_BROWSER_RESULT_CHARS) {
		return value;
	}

	if (Array.isArray(value)) {
		const result: unknown[] = [];
		let size = 2;

		for (const item of value) {
			const itemSize = JSON.stringify(item).length + 1;

			if (size + itemSize > MAX_BROWSER_RESULT_CHARS) {
				break;
			}

			result.push(item);
			size += itemSize;
		}

		if (result.length > 0) {
			return result;
		}
	}

	return {
		truncated: true,
		note: `Result is too large (${json.length} characters); narrow the request.`,
		preview: `${json.slice(0, MAX_BROWSER_RESULT_CHARS)}...`,
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
					"Response is not a supported text-like content type. Use browser_markdown for rendered pages or a future asset import tool for binary content.",
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
