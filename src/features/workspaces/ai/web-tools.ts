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
			strict: true,
			execute: async ({ url }) => {
				const safeUrl = assertPublicHttpUrl(url);
				return truncateMarkdown(
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
			strict: true,
			execute: async ({ url }) => {
				const safeUrl = assertPublicHttpUrl(url);
				return truncateLinks(
					await browserLinks(browser, {
						url: safeUrl.toString(),
					}),
				);
			},
		}),
	};
}

function truncateMarkdown(content: string) {
	if (content.length <= MAX_BROWSER_RESULT_CHARS) {
		return {
			content,
			truncated: false,
		};
	}

	return {
		content: content.slice(0, MAX_BROWSER_RESULT_CHARS),
		truncated: true,
	};
}

function truncateLinks(items: string[]) {
	const json = JSON.stringify(items);

	if (json.length <= MAX_BROWSER_RESULT_CHARS) {
		return {
			items,
			truncated: false,
		};
	}

	const result: string[] = [];
	let size = 2;

	for (const item of items) {
		const itemSize = JSON.stringify(item).length + 1;

		if (size + itemSize > MAX_BROWSER_RESULT_CHARS) {
			break;
		}

		result.push(item);
		size += itemSize;
	}

	return {
		items: result,
		truncated: true,
	};
}
