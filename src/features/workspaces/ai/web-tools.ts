import {
	browserLinks,
	browserMarkdown,
	type QuickActionBinding,
} from "@cloudflare/think/tools/browser";
import type { ToolSet } from "ai";
import { tool } from "ai";
import { z } from "zod";

import { assertPublicHttpUrl } from "#/features/workspaces/ai/web-access-policy";

const MAX_BROWSER_RESULT_CHARS = 50_000;

const browserPageInputSchema = z.object({
	url: z
		.url()
		.describe("Public HTTP(S) URL to load in Cloudflare Browser Run."),
});

const browserPageInputExamples = [
	{
		input: {
			url: "https://example.com",
		},
	},
];

export function createAIThreadWebTools(env: Env): ToolSet {
	const browser = env.BROWSER as unknown as QuickActionBinding;

	return {
		web_markdown: tool({
			description:
				"Load a public webpage and return its rendered content as Markdown.",
			inputSchema: browserPageInputSchema,
			inputExamples: browserPageInputExamples,
			execute: async ({ url }) => {
				const safeUrl = assertPublicHttpUrl(url);
				return truncateText(
					await browserMarkdown(browser, {
						url: safeUrl.toString(),
					}),
				);
			},
		}),
		web_links: tool({
			description: "Load a public webpage and return its rendered links.",
			inputSchema: browserPageInputSchema,
			inputExamples: browserPageInputExamples,
			execute: async ({ url }) => {
				const safeUrl = assertPublicHttpUrl(url);
				return boundJsonResult(
					await browserLinks(browser, {
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
