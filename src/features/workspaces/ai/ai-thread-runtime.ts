import type { WorkspaceLike } from "@cloudflare/think/tools/workspace";
import { createWorkspaceTools } from "@cloudflare/think/tools/workspace";
import type { LanguageModel, ToolSet, UIMessage } from "ai";
import {
	addToolInputExamplesMiddleware,
	createGateway,
	generateText,
	tool,
	wrapLanguageModel,
} from "ai";
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

const AI_THREAD_TITLE_GATEWAY_MODEL = "google/gemini-2.5-flash-lite";
const AI_THREAD_TITLE_FALLBACK_MODELS = ["openai/gpt-4.1-nano"] as const;

type WorkspaceAiProviderOptions = NonNullable<
	Parameters<typeof generateText>[0]["providerOptions"]
>;

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

const emptyToolInputExamples = [{ input: {} }];
const timeCalculateRelativeInputExamples = [
	{
		input: {
			days_ago: 7,
		},
	},
];
const sandboxReadFileInputExamples = [
	{
		input: {
			path: "/scratch/notes.md",
			offset: 1,
			limit: 40,
		},
	},
];
const sandboxWriteFileInputExamples = [
	{
		input: {
			path: "/scratch/notes.md",
			content: "# Scratch Notes\nTemporary assistant work goes here.",
		},
	},
];
const sandboxEditFileInputExamples = [
	{
		input: {
			path: "/scratch/notes.md",
			old_string: "# Scratch Notes",
			new_string: "# Updated Scratch Notes",
		},
	},
];
const sandboxListFilesInputExamples = [
	{
		input: {
			path: "/",
			limit: 50,
		},
	},
];
const sandboxFindFilesInputExamples = [
	{
		input: {
			pattern: "**/*.md",
		},
	},
];
const sandboxSearchFilesInputExamples = [
	{
		input: {
			query: "TODO",
			include: "**/*.md",
			fixedString: true,
		},
	},
];
const sandboxDeleteFileInputExamples = [
	{
		input: {
			path: "/scratch/notes.md",
		},
	},
];

const THINK_CAPABILITY_BLOCK_MARKER = "You are running inside a Think agent.";

const AI_THREAD_WORKSPACE_MUTATION_TOOLS = [
	"workspace_create_items",
	"workspace_move_items",
	"workspace_delete_items",
	"workspace_rename_items",
	"workspace_edit_item",
] as const;

const AI_THREAD_BASE_ACTIVE_TOOLS = [
	"sandbox_read_file",
	"sandbox_write_file",
	"sandbox_edit_file",
	"sandbox_list_files",
	"sandbox_find_files",
	"sandbox_search_files",
	"sandbox_delete_file",
	"web_markdown",
	"web_links",
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
	"- Workspace access: view-only. Do not create, rename, edit, move, or delete workspace items.";

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
			inputExamples: emptyToolInputExamples,
			execute: async () => formatTimeToolResult(new Date()),
		}),
		time_calculate_relative: tool({
			description:
				"Return a past UTC time relative to now. Use for date filters like yesterday, last week, or 3 months ago.",
			inputSchema: timeCalculateRelativeInputSchema,
			inputExamples: timeCalculateRelativeInputExamples,
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
				"Read a private sandbox file. This does not read the actual ThinkEx workspace.",
			inputExamples: sandboxReadFileInputExamples,
		},
		sandbox_write_file: {
			...tools.write,
			description:
				"Write a private sandbox file for assistant scratch work. This does not change actual ThinkEx workspace items.",
			inputExamples: sandboxWriteFileInputExamples,
		},
		sandbox_edit_file: {
			...tools.edit,
			description:
				"Edit a private sandbox file by exact string replacement. This does not edit actual ThinkEx workspace items.",
			inputExamples: sandboxEditFileInputExamples,
		},
		sandbox_list_files: {
			...tools.list,
			description:
				"List private sandbox files and directories. This does not list the actual ThinkEx workspace.",
			inputExamples: sandboxListFilesInputExamples,
		},
		sandbox_find_files: {
			...tools.find,
			description:
				"Find private sandbox files by glob pattern. This does not search the actual ThinkEx workspace.",
			inputExamples: sandboxFindFilesInputExamples,
		},
		sandbox_search_files: {
			...tools.grep,
			description:
				"Search private sandbox file contents. This does not search actual ThinkEx workspace items.",
			inputExamples: sandboxSearchFilesInputExamples,
		},
		sandbox_delete_file: {
			...tools.delete,
			description:
				"Delete a private sandbox file or directory. This does not delete actual ThinkEx workspace items.",
			inputExamples: sandboxDeleteFileInputExamples,
		},
	};
}

export function getWorkspaceAiLanguageModel(
	modelId: ReturnType<typeof resolveWorkspaceAiChatModelId>,
	env: Env,
	_sessionAffinity: string,
): LanguageModel {
	return getWorkspaceAiLanguageModelForGatewayModel(
		getWorkspaceAiChatModel(modelId),
		env,
	);
}

function getWorkspaceAiLanguageModelForGatewayModel(
	gatewayModel: string,
	env: Env,
): LanguageModel {
	const gateway = createGateway({
		apiKey: getVercelAiGatewayApiKey(env),
	});

	return wrapLanguageModel({
		model: gateway(gatewayModel),
		middleware: addToolInputExamplesMiddleware({
			prefix: "Valid input examples:",
		}),
	});
}

function getWorkspaceAiGatewayTransportOptions() {
	return {
		caching: "auto" as const,
		providerTimeouts: {
			byok: {
				azure: 8000,
				bedrock: 8000,
				openai: 8000,
				vertex: 8000,
			},
		},
	};
}

export function getWorkspaceAiGatewayProviderOptions(input?: {
	modelId?: ReturnType<typeof resolveWorkspaceAiChatModelId>;
	thread?: AIThreadContext;
	tags?: string[];
}): WorkspaceAiProviderOptions {
	const modelId = input?.modelId ?? DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID;
	const tags = [
		"app:thinkex",
		"feature:workspace-chat",
		`model:${modelId}`,
		input?.thread ? `workspace:${input.thread.workspaceId}` : undefined,
		input?.thread
			? input.thread.promptScope.canMutate
				? "mode:mutate"
				: "mode:view"
			: undefined,
		...(input?.tags ?? []),
	].filter((tag): tag is string => Boolean(tag));

	return {
		gateway: {
			...getWorkspaceAiGatewayTransportOptions(),
			...getWorkspaceAiGatewayRoutingOptions(modelId),
			tags,
			user: input?.thread?.userId,
		},
		...getWorkspaceAiReasoningOptions(modelId),
	} as unknown as WorkspaceAiProviderOptions;
}

function getWorkspaceAiGatewayRoutingOptions(
	modelId: ReturnType<typeof resolveWorkspaceAiChatModelId>,
) {
	switch (modelId) {
		case "claude-sonnet":
			return {
				order: ["bedrock", "vertex"],
				models: ["google/gemini-3-flash", "openai/gpt-5.4-mini"],
				sort: "ttft",
			};
		case "gemini":
			return {
				order: ["google", "vertex"],
				models: ["openai/gpt-5.4-mini"],
				sort: "ttft",
			};
		case "chatgpt":
			return {
				order: ["openai", "azure"],
				models: ["google/gemini-3-flash", "openai/gpt-5.4-mini"],
				sort: "ttft",
			};
		default:
			return {};
	}
}

function getWorkspaceAiReasoningOptions(
	modelId: ReturnType<typeof resolveWorkspaceAiChatModelId>,
) {
	switch (modelId) {
		case "claude-sonnet":
			return {
				bedrock: {
					reasoningConfig: { type: "adaptive", maxReasoningEffort: "low" },
				},
			};
		case "gemini":
			return {
				google: {
					thinkingConfig: { thinkingLevel: "low" },
				},
				vertex: {
					thinkingConfig: { thinkingLevel: "low" },
				},
			};
		case "chatgpt":
			return {
				openai: {
					reasoningEffort: "none",
				},
			};
		default:
			return {};
	}
}

function getVercelAiGatewayApiKey(env: Env) {
	const apiKey =
		(env as { AI_GATEWAY_API_KEY?: string }).AI_GATEWAY_API_KEY ??
		process.env.AI_GATEWAY_API_KEY;

	if (!apiKey) {
		throw new Error("AI_GATEWAY_API_KEY is required to use Vercel AI Gateway.");
	}

	return apiKey;
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
		model: getWorkspaceAiLanguageModelForGatewayModel(
			AI_THREAD_TITLE_GATEWAY_MODEL,
			input.env,
		),
		providerOptions: {
			gateway: {
				...getWorkspaceAiGatewayTransportOptions(),
				order: ["google", "vertex"],
				models: [...AI_THREAD_TITLE_FALLBACK_MODELS],
				sort: "ttft",
				tags: [
					"app:thinkex",
					"feature:workspace-chat",
					"task:title-generation",
					`model:${AI_THREAD_TITLE_GATEWAY_MODEL}`,
				],
			},
			google: {
				thinkingConfig: { thinkingLevel: "low" },
			},
			vertex: {
				thinkingConfig: { thinkingLevel: "low" },
			},
		} as WorkspaceAiProviderOptions,
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
