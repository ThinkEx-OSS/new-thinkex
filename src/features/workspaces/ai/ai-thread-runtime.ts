import type { WorkspaceLike } from "@cloudflare/think/tools/workspace";
import { createWorkspaceTools } from "@cloudflare/think/tools/workspace";
import type { LanguageModel, ToolSet, UIMessage } from "ai";
import { generateText, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { anthropic } from "workers-ai-provider/anthropic";
import { google } from "workers-ai-provider/google";
import { openai } from "workers-ai-provider/openai";
import { z } from "zod";

import type {
	AIThreadContext,
	AIThreadPromptScope,
} from "#/features/workspaces/ai/ai-thread-metadata";
import {
	DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
	getWorkspaceAiChatModel,
	type resolveWorkspaceAiChatModelId,
} from "#/features/workspaces/ai/models";
import { createAIThreadWebTools } from "#/features/workspaces/ai/web-tools";
import { createAIThreadWorkspaceTools } from "#/features/workspaces/ai/workspace-tools";
import { formatWorkspaceAiContextForPrompt } from "#/features/workspaces/model/workspace-ai-context";

const thinkPromptSectionDivider =
	"══════════════════════════════════════════════";

const timeCalculateRelativeInputSchema = z.object({
	days_ago: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Days to subtract from now."),
	months_ago: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Calendar months to subtract from now."),
	weeks_ago: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Weeks to subtract from now."),
	years_ago: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Calendar years to subtract from now."),
});

const THINK_CAPABILITY_BLOCK_MARKER = "You are running inside a Think agent.";

const AI_THREAD_WORKSPACE_MUTATION_TOOLS = ["workspace_edit_item"] as const;

const AI_THREAD_BASE_ACTIVE_TOOLS = [
	"sandbox_read_file",
	"sandbox_write_file",
	"sandbox_edit_file",
	"sandbox_list_files",
	"sandbox_find_files",
	"sandbox_search_files",
	"sandbox_delete_file",
	"web_fetch_url",
	"browser_markdown",
	"browser_links",
	"browser_scrape",
	"workspace_list_items",
	"workspace_read_items",
	"time_get_current",
	"time_calculate_relative",
] as const;

export const AI_THREAD_ACTIVE_TOOLS = [
	...AI_THREAD_BASE_ACTIVE_TOOLS,
	...AI_THREAD_WORKSPACE_MUTATION_TOOLS,
] as const;

export function getAIThreadActiveTools(canMutate: boolean) {
	return canMutate
		? [...AI_THREAD_ACTIVE_TOOLS]
		: [...AI_THREAD_BASE_ACTIVE_TOOLS];
}

const AI_THREAD_VIEW_ONLY_WORKSPACE_LINE =
	"- Workspace access: view-only. Do not create, edit, move, or delete workspace items.";

export function createAIThreadTools(input: {
	env: Env;
	workspace: WorkspaceLike;
	getThreadContext: () => Promise<AIThreadContext | null>;
}): ToolSet {
	const sandboxTools = createSandboxTools(input.workspace);

	return {
		...sandboxTools,
		...createAIThreadWebTools(input.env),
		...createAIThreadTimeTools(),
		...createAIThreadWorkspaceTools({
			getThreadContext: input.getThreadContext,
		}),
	};
}

function createAIThreadTimeTools(): ToolSet {
	return {
		time_get_current: tool({
			description:
				"Return the current UTC time as ISO 8601 plus Unix timestamps.",
			inputSchema: z.object({}),
			execute: async () => formatTimeToolResult(new Date()),
		}),
		time_calculate_relative: tool({
			description:
				"Return a past UTC time relative to now. Use for date filters like yesterday, last week, or 3 months ago.",
			inputSchema: timeCalculateRelativeInputSchema,
			execute: async ({ days_ago, months_ago, weeks_ago, years_ago }) => {
				const current = new Date();
				const calculated = subtractRelativeUtcDate(current, {
					daysAgo: days_ago ?? 0,
					monthsAgo: months_ago ?? 0,
					weeksAgo: weeks_ago ?? 0,
					yearsAgo: years_ago ?? 0,
				});

				return {
					current: formatTimeToolResult(current),
					calculated: formatTimeToolResult(calculated),
					offset: {
						days_ago: days_ago ?? 0,
						months_ago: months_ago ?? 0,
						weeks_ago: weeks_ago ?? 0,
						years_ago: years_ago ?? 0,
					},
				};
			},
		}),
	};
}

function createSandboxTools(workspace: WorkspaceLike): ToolSet {
	const tools = createWorkspaceTools(workspace);

	return {
		sandbox_read_file: {
			...tools.read,
			description:
				"Read a private sandbox file. Text files return line-numbered content; images and PDFs are passed through when supported. Use offset and limit for large text files. This does not read the actual ThinkEx workspace.",
		},
		sandbox_write_file: {
			...tools.write,
			description:
				"Write content to a private sandbox file for assistant scratch work. Creates parent directories automatically and overwrites existing files. This does not create or change actual ThinkEx workspace items.",
		},
		sandbox_edit_file: {
			...tools.edit,
			description:
				"Edit a private sandbox file by replacing an exact string. The old_string must match exactly, including whitespace and indentation. This does not edit actual ThinkEx workspace items.",
		},
		sandbox_list_files: {
			...tools.list,
			description:
				"List private sandbox files and directories at a path. Returns names, types, and sizes. This does not list the actual ThinkEx workspace.",
		},
		sandbox_find_files: {
			...tools.find,
			description:
				"Find private sandbox files by glob pattern. Supports *, **, and ?. Returns matching paths with types and sizes. This does not search the actual ThinkEx workspace.",
		},
		sandbox_search_files: {
			...tools.grep,
			description:
				"Search private sandbox file contents using a regex or fixed string. Returns matching lines with file paths and line numbers. This does not search actual ThinkEx workspace items.",
		},
		sandbox_delete_file: {
			...tools.delete,
			description:
				"Delete a private sandbox file or directory. Set recursive to true for non-empty directories. This does not delete actual ThinkEx workspace items.",
		},
	};
}

export function getWorkersAiModel(
	modelId: ReturnType<typeof resolveWorkspaceAiChatModelId>,
	env: Env,
	sessionAffinity: string,
): LanguageModel {
	const workersAi = createWorkersAI({
		binding: env.AI,
		gateway: { id: env.AI_GATEWAY_ID },
		providers: [anthropic, google, openai],
	});

	return workersAi(getWorkspaceAiChatModel(modelId), {
		sessionAffinity,
	});
}

export async function generateAIThreadTitle(input: {
	env: Env;
	messages: UIMessage[];
	sessionAffinity: string;
}) {
	const firstUserMessage = getFirstUserMessageText(input.messages);

	if (!firstUserMessage) {
		return undefined;
	}

	const result = await generateText({
		model: getWorkersAiModel(
			DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
			input.env,
			input.sessionAffinity,
		),
		prompt: [
			"Write a concise chat title for this first user message.",
			"Return only the title. No quotes. No punctuation at the end.",
			"Use 2 to 6 words.",
			"",
			firstUserMessage,
		].join("\n"),
		temperature: 0.2,
	});

	return result.text;
}

export function getAIThreadSoulPrompt() {
	return [
		"You are ThinkEx's workspace assistant.",
		"Help the user understand, organize, and work in their actual ThinkEx workspace.",
		"Actual workspace means user-visible ThinkEx content. Private sandbox means assistant-only scratch files.",
		"Use actual workspace tools to inspect workspace contents; change the workspace only through actual workspace mutation tools.",
		"Never use private sandbox files as user-visible workspace items.",
		"Do not claim to have read actual workspace content unless an actual workspace tool returned it.",
		"Resolve this/it/that/here/above/the page/this file from current-turn context: selected quotes, then active view, then active/open items. Ask briefly before changes if ambiguous.",
		"Web tools read public web content only.",
		"Use time_get_current for exact UTC now and time_calculate_relative for UTC date filters; the current turn includes user-local date/time context.",
		"Use memory only for durable preferences, workspace goals, thread goals, and decisions. Do not store transient requests, secrets, full documents, item bodies, or actual workspace state.",
		"Follow tool descriptions and schemas. Keep answers concise, concrete, and action-oriented.",
	]
		.filter(Boolean)
		.join("\n");
}

export function getAIThreadSystemPromptForWorkspace(
	system: string,
	promptScope: AIThreadPromptScope,
	options: {
		now?: Date;
		timeZone?: string;
		workspaceAiContext?: unknown;
	} = {},
) {
	return [
		stripThinkCapabilityBlock(system),
		getThinkExRuntimeScopePrompt(promptScope, options),
	].join("\n\n");
}

function stripThinkCapabilityBlock(system: string) {
	const markerIndex = system.indexOf(THINK_CAPABILITY_BLOCK_MARKER);

	if (markerIndex === -1) {
		return system.trimEnd();
	}

	return system.slice(0, markerIndex).trimEnd();
}

function getThinkExRuntimeScopePrompt(
	promptScope: AIThreadPromptScope,
	options: {
		now?: Date;
		timeZone?: string;
		workspaceAiContext?: unknown;
	},
) {
	const timeZone = getPromptTimeZone(options.timeZone);
	const workspaceAiContext = formatWorkspaceAiContextForPrompt(
		options.workspaceAiContext,
	);

	return [
		thinkPromptSectionDivider,
		"CURRENT TURN [readonly]",
		thinkPromptSectionDivider,
		`- Workspace: ${promptScope.workspaceName}`,
		promptScope.canMutate ? null : AI_THREAD_VIEW_ONLY_WORKSPACE_LINE,
		`- Date/time: ${formatPromptDateTime(options.now ?? new Date(), timeZone)}`,
		"- Actual workspace paths are absolute, such as /.",
		workspaceAiContext ? `\n${workspaceAiContext}` : "",
	]
		.filter(Boolean)
		.join("\n");
}

function getPromptTimeZone(value: string | undefined) {
	if (!value?.trim()) {
		return "UTC";
	}

	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value });
		return value;
	} catch {
		return "UTC";
	}
}

const promptDateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getPromptDateTimeFormatter(timeZone: string) {
	const cachedFormatter = promptDateTimeFormatters.get(timeZone);

	if (cachedFormatter) {
		return cachedFormatter;
	}

	const formatter = new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZone,
		timeZoneName: "short",
	});
	promptDateTimeFormatters.set(timeZone, formatter);

	return formatter;
}

function formatPromptDateTime(date: Date, timeZone: string) {
	return `${getPromptDateTimeFormatter(timeZone).format(date)} (${timeZone})`;
}

function formatTimeToolResult(date: Date) {
	return {
		timestampSeconds: Math.floor(date.getTime() / 1000),
		timestampMilliseconds: date.getTime(),
		isoUtc: date.toISOString(),
		timeZone: "UTC",
	};
}

function subtractRelativeUtcDate(
	date: Date,
	input: {
		daysAgo: number;
		monthsAgo: number;
		weeksAgo: number;
		yearsAgo: number;
	},
) {
	const calendarAdjusted = subtractUtcCalendarMonthsAndYears(
		date,
		input.monthsAgo,
		input.yearsAgo,
	);
	const days = input.daysAgo + input.weeksAgo * 7;

	return new Date(calendarAdjusted.getTime() - days * 24 * 60 * 60 * 1000);
}

function subtractUtcCalendarMonthsAndYears(
	date: Date,
	monthsAgo: number,
	yearsAgo: number,
) {
	const targetMonthStart = new Date(
		Date.UTC(
			date.getUTCFullYear() - yearsAgo,
			date.getUTCMonth() - monthsAgo,
			1,
			date.getUTCHours(),
			date.getUTCMinutes(),
			date.getUTCSeconds(),
			date.getUTCMilliseconds(),
		),
	);
	const lastTargetMonthDay = new Date(
		Date.UTC(
			targetMonthStart.getUTCFullYear(),
			targetMonthStart.getUTCMonth() + 1,
			0,
		),
	).getUTCDate();
	const targetDay = Math.min(date.getUTCDate(), lastTargetMonthDay);

	return new Date(
		Date.UTC(
			targetMonthStart.getUTCFullYear(),
			targetMonthStart.getUTCMonth(),
			targetDay,
			date.getUTCHours(),
			date.getUTCMinutes(),
			date.getUTCSeconds(),
			date.getUTCMilliseconds(),
		),
	);
}

function getFirstUserMessageText(messages: UIMessage[]) {
	const firstUserMessage = messages.find((message) => message.role === "user");

	if (!firstUserMessage) {
		return "";
	}

	return firstUserMessage.parts
		.filter((part): part is { type: "text"; text: string } => {
			return part.type === "text";
		})
		.map((part) => part.text)
		.join("\n")
		.trim()
		.slice(0, 1000);
}
