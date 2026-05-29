import type { ToolSet } from "ai";
import { tool } from "ai";
import { z } from "zod";

import { assertPublicHttpUrl } from "#/features/workspaces/ai/web-access-policy";

const DEFAULT_FETCH_MAX_BYTES = 200_000;
const MAX_FETCH_BYTES = 512_000;
const MAX_BROWSER_TEXT_BYTES = 1_000_000;
const MAX_BROWSER_ARRAY_ITEMS = 300;
const MAX_BROWSER_OBJECT_KEYS = 120;
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
		.string()
		.url()
		.describe(
			"Public HTTP(S) URL to fetch. Use for APIs, feeds, raw files, or simple static pages.",
		),
});

const browserReadActionSchema = z.enum(["markdown", "content", "links"]);

const readWebPageInputSchema = z.object({
	action: browserReadActionSchema
		.optional()
		.describe(
			"Browser Run action to use. markdown is best for normal rendered-page reading; content returns rendered HTML; links returns final-page links.",
		),
	url: z
		.string()
		.url()
		.describe("Public HTTP(S) URL to load with Browser Run Quick Actions."),
});

type BrowserQuickAction = z.infer<typeof browserReadActionSchema>;
type BrowserQuickActionBinding = Fetcher & {
	quickAction(
		action: BrowserQuickAction,
		options: { url: string },
	): Promise<Response>;
};

export function createAIThreadWebTools(env: Env): ToolSet {
	return {
		readUrl: tool({
			description:
				"Fetch a public HTTP(S) URL with a cheap network request. Use this for APIs, feeds, raw files, static text, and simple HTML. If the page is JavaScript-heavy or the user asks for rendered page content, use readWebPage instead.",
			inputSchema: readUrlInputSchema,
			execute: async ({ maxBytes, url }) => {
				return readPublicUrl(url, maxBytes ?? DEFAULT_FETCH_MAX_BYTES);
			},
		}),
		readWebPage: tool({
			description:
				"Read a public webpage using Cloudflare Browser Run Quick Actions. Use this for rendered pages, JavaScript-heavy pages, markdown conversion, or final DOM links. This does not provide arbitrary browser control.",
			inputSchema: readWebPageInputSchema,
			execute: async ({ action = "markdown", url }) => {
				const safeUrl = assertPublicHttpUrl(url);
				const browser = env.BROWSER as BrowserQuickActionBinding;
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
					"Response is not a supported text-like content type. Use readWebPage for rendered pages or a future asset import tool for binary content.",
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

async function normalizeBrowserQuickActionResult(
	action: BrowserQuickAction,
	result: Response,
) {
	const contentType = result.headers.get("content-type") ?? "";
	const metadata = responseMetadata(result);

	if (contentType.includes("application/json")) {
		return normalizeBrowserActionPayload(
			action,
			extractQuickActionResult(await result.json()),
			metadata,
		);
	}

	if (isTextLikeContentType(contentType)) {
		const body = await readResponseText(result, MAX_BROWSER_TEXT_BYTES);
		return normalizeBrowserActionPayload(action, body.text, metadata, {
			truncated: body.truncated,
		});
	}

	return {
		kind: "unsupported_content_type",
		metadata,
		error:
			"Browser Run returned binary content. This chat tool reports metadata only; saving binary artifacts to the workspace should use a dedicated import tool.",
	};
}

function responseMetadata(response: Response, url?: URL) {
	return {
		browserMsUsed: response.headers.get("x-browser-ms-used"),
		contentLength: getContentLength(response),
		contentType: response.headers.get("content-type"),
		status: response.status,
		statusText: response.statusText,
		url: url?.toString() ?? response.url,
	};
}

function normalizeBrowserActionPayload(
	action: BrowserQuickAction,
	payload: unknown,
	metadata: ReturnType<typeof responseMetadata>,
	options: { truncated?: boolean } = {},
) {
	const compacted = compactBrowserPayload(payload);

	if (action === "links") {
		return {
			kind: "links",
			links: getStringArrayPayload(compacted.value),
			metadata,
			truncated: options.truncated || compacted.truncated,
		};
	}

	const text = getStringPayload(compacted.value);
	const truncated = options.truncated || compacted.truncated;

	if (action === "markdown") {
		return {
			kind: "markdown",
			markdown: text,
			metadata,
			truncated,
		};
	}

	return {
		kind: "content",
		html: text,
		metadata,
		truncated,
	};
}

async function readResponseText(response: Response, maxBytes: number) {
	if (!response.body) {
		return { text: "", truncated: false };
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;
	let truncated = false;

	while (true) {
		const { done, value } = await reader.read();

		if (done) {
			break;
		}

		const remaining = maxBytes - received;

		if (remaining <= 0) {
			truncated = true;
			break;
		}

		const chunk =
			value.byteLength > remaining ? value.slice(0, remaining) : value;
		chunks.push(chunk);
		received += chunk.byteLength;

		if (value.byteLength > remaining) {
			truncated = true;
			break;
		}
	}

	await reader.cancel().catch(() => undefined);

	return {
		text: new TextDecoder().decode(concatBytes(chunks, received)),
		truncated,
	};
}

function concatBytes(chunks: Uint8Array[], length: number) {
	const bytes = new Uint8Array(length);
	let offset = 0;

	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return bytes;
}

function isRedirect(status: number) {
	return status >= 300 && status < 400;
}

function isTextLikeContentType(contentType: string) {
	const normalized = contentType.toLowerCase();

	return (
		normalized.startsWith("text/") ||
		normalized.includes("json") ||
		normalized.includes("xml") ||
		normalized.includes("javascript") ||
		normalized.includes("x-www-form-urlencoded")
	);
}

function getContentLength(response: Response) {
	const contentLength = response.headers.get("content-length");
	const parsed = contentLength ? Number(contentLength) : undefined;

	return Number.isFinite(parsed) ? parsed : undefined;
}

function extractQuickActionResult(value: unknown) {
	if (isRecord(value) && "result" in value) {
		return value.result;
	}

	return value;
}

function getStringPayload(value: unknown) {
	if (typeof value === "string") {
		return value;
	}

	return JSON.stringify(value) ?? "";
}

function getStringArrayPayload(value: unknown) {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === "string");
	}

	return typeof value === "string" ? [value] : [];
}

function compactBrowserPayload(value: unknown) {
	const state = {
		remainingCharacters: MAX_BROWSER_TEXT_BYTES,
		truncated: false,
	};
	const compacted = compactLargeValues(value, state);

	return {
		truncated: state.truncated,
		value: compacted,
	};
}

function compactLargeValues(
	value: unknown,
	state: { remainingCharacters: number; truncated: boolean },
): unknown {
	if (typeof value === "string") {
		if (value.length <= state.remainingCharacters) {
			state.remainingCharacters -= value.length;
			return value;
		}

		state.truncated = true;
		const slice = value.slice(0, Math.max(0, state.remainingCharacters));
		state.remainingCharacters = 0;
		return `${slice}\n[truncated]`;
	}

	if (Array.isArray(value)) {
		if (value.length > MAX_BROWSER_ARRAY_ITEMS) {
			state.truncated = true;
		}

		return value
			.slice(0, MAX_BROWSER_ARRAY_ITEMS)
			.map((item) => compactLargeValues(item, state));
	}

	if (!value || typeof value !== "object") {
		return value;
	}

	const entries = Object.entries(value);

	if (entries.length > MAX_BROWSER_OBJECT_KEYS) {
		state.truncated = true;
	}

	return Object.fromEntries(
		entries
			.slice(0, MAX_BROWSER_OBJECT_KEYS)
			.map(([key, nestedValue]) => [
				key,
				compactLargeValues(nestedValue, state),
			]),
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
