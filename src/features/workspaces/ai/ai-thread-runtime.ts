import type { LanguageModel, ToolSet, UIMessage } from "ai";
import { generateText, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";

import type { AIThreadContext } from "#/features/workspaces/ai/ai-thread-metadata";
import {
	DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
	getWorkspaceAiChatModel,
	type resolveWorkspaceAiChatModelId,
} from "#/features/workspaces/ai/models";
import { createAIThreadWebTools } from "#/features/workspaces/ai/web-tools";
import { listWorkspaceKernelItems } from "#/features/workspaces/kernel/workspace-kernel-access";

const workspaceItemListInputSchema = z.object({
	limit: z
		.number()
		.int()
		.min(1)
		.max(200)
		.optional()
		.describe("Maximum number of entries to return. Defaults to 100."),
	path: z
		.string()
		.min(1)
		.optional()
		.describe(
			"Absolute workspace path to list. Defaults to the workspace root (/).",
		),
	recursive: z
		.boolean()
		.optional()
		.describe(
			"List nested descendants, like ls -R. Defaults to false for immediate children only.",
		),
});

export function createAIThreadTools(input: {
	env: Env;
	getThreadContext: () => Promise<AIThreadContext | null>;
}): ToolSet {
	return {
		...createAIThreadWebTools(input.env),
		listWorkspaceItems: tool({
			description:
				"List the real ThinkEx workspace like ls. Use absolute paths such as /. By default this returns immediate children; set recursive to true for a tree-style listing.",
			inputSchema: workspaceItemListInputSchema,
			execute: async ({ limit, path, recursive }) => {
				const thread = await input.getThreadContext();

				if (!thread) {
					throw new Error("Chat thread not found");
				}

				return await listWorkspaceKernelItems({
					workspaceId: thread.workspaceId,
					userId: thread.userId,
					path,
					recursive,
					limit,
				});
			},
		}),
	};
}

export function getWorkersAiModel(
	modelId: ReturnType<typeof resolveWorkspaceAiChatModelId>,
	env: Env,
	sessionAffinity: string,
): LanguageModel {
	const workersAi = createWorkersAI({ binding: env.AI });

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
		"You are Thinkex's workspace assistant.",
		"WorkspaceKernel is the source of truth for user-visible workspace items, files, revisions, events, and permissions.",
		"Your private Think workspace is scratch space only. Do not treat private scratch files as user-visible workspace state.",
		"Use workspace tools when the user asks about workspace contents or structure.",
		"Do not claim to have read workspace content unless a tool result provides it.",
		"Use memory only for durable, concise user preferences, workspace goals, thread goals, and decisions that should help future turns in this thread.",
		"Do not update memory for transient requests or information already stored in WorkspaceKernel.",
		"Do not store full documents, item bodies, large file text, secrets, or source-of-truth workspace state in memory.",
		"User-visible workspace output must be created or changed through product workspace tools.",
		"Keep answers concise, concrete, and action-oriented.",
	]
		.filter(Boolean)
		.join("\n");
}

export function getAIThreadSystemPromptForWorkspace(
	system: string,
	workspaceId: string,
) {
	return [
		system,
		[
			"Current ThinkEx runtime scope:",
			`- Workspace id: ${workspaceId}`,
			"- Use absolute workspace paths such as / when calling workspace tools.",
		].join("\n"),
	].join("\n\n");
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
