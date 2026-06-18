import type { ToolSet } from "ai";
import { tool } from "ai";
import { z } from "zod";

import type { AIThreadContext } from "#/features/workspaces/ai/ai-thread-metadata";
import {
	editWorkspaceKernelAiItem,
	readWorkspaceKernelAiItems,
} from "#/features/workspaces/ai/workspace-kernel-ai-access";
import { documentMarkdownEditSchema } from "#/features/workspaces/documents/document-markdown-edits";
import { listWorkspaceKernelItems } from "#/features/workspaces/kernel/workspace-kernel-access";

const workspaceItemListInputSchema = z.object({
	limit: z
		.number()
		.int()
		.min(1)
		.max(200)
		.optional()
		.describe("Maximum number of workspace items to return. Defaults to 100."),
	path: z
		.string()
		.min(1)
		.optional()
		.describe("Absolute path in the actual ThinkEx workspace. Defaults to /."),
	recursive: z
		.boolean()
		.optional()
		.describe(
			"Include nested descendants. Defaults to false for immediate children only.",
		),
});

const workspaceReadItemsInputSchema = z.object({
	contentLimit: z
		.number()
		.int()
		.min(1)
		.max(2000)
		.optional()
		.describe(
			"Maximum Markdown lines to return for documents and extracted PDFs. Defaults to 2000.",
		),
	contentOffset: z
		.number()
		.int()
		.min(1)
		.optional()
		.describe(
			"1-based Markdown line offset for documents and extracted PDFs. Use the returned page.next value to continue.",
		),
	paths: z
		.array(z.string().min(1))
		.min(1)
		.max(20)
		.describe("Absolute paths in the actual ThinkEx workspace to read."),
	recursive: z
		.boolean()
		.optional()
		.describe("For folder paths, include nested descendants in the listing."),
});

const workspaceEditItemInputSchema = z.object({
	path: z
		.string()
		.min(1)
		.describe("Absolute path of one actual ThinkEx workspace item to edit."),
	description: z
		.string()
		.trim()
		.min(1)
		.max(240)
		.describe("Short user-visible description of the edit being made."),
	edits: z
		.array(documentMarkdownEditSchema)
		.min(1)
		.max(40)
		.describe("Ordered text edits to apply to the item projection."),
});

export function createAIThreadWorkspaceTools(input: {
	getThreadContext: () => Promise<AIThreadContext | null>;
}): ToolSet {
	return {
		workspace_list_items: tool({
			description:
				"List items in the actual ThinkEx workspace. Use this for user-visible workspace structure; use absolute paths such as /.",
			inputSchema: workspaceItemListInputSchema,
			execute: async ({ limit, path, recursive }) => {
				const thread = await requireThreadContext(input.getThreadContext);

				return await listWorkspaceKernelItems({
					workspaceId: thread.workspaceId,
					userId: thread.userId,
					path,
					recursive,
					limit,
				});
			},
		}),
		workspace_read_items: tool({
			description:
				"Read actual ThinkEx workspace items by absolute path. Documents return Markdown. Folders return listings. Ready PDF files return extracted Markdown; PDFs still queued, processing, or failed return concise extraction status. Images and other files without text projections return metadata and an explicit no-text-projection reason. A page object is included only when content is truncated or a non-default offset was requested; if page.next is present, use contentOffset=page.next to continue. Unsupported item types are reported explicitly.",
			inputSchema: workspaceReadItemsInputSchema,
			execute: async ({ contentLimit, contentOffset, paths, recursive }) => {
				const thread = await requireThreadContext(input.getThreadContext);

				return await readWorkspaceKernelAiItems({
					contentLimit,
					contentOffset,
					workspaceId: thread.workspaceId,
					userId: thread.userId,
					paths,
					recursive,
				});
			},
		}),
		workspace_edit_item: tool({
			description:
				"Edit one actual ThinkEx workspace document by absolute path. Read before editing unless the user requested a simple append or prepend. Edits affect the real user-visible workspace, not the private sandbox.",
			inputSchema: workspaceEditItemInputSchema,
			execute: async ({ path, edits }) => {
				const thread = await requireThreadContext(input.getThreadContext);

				return await editWorkspaceKernelAiItem({
					workspaceId: thread.workspaceId,
					userId: thread.userId,
					path,
					edits,
				});
			},
		}),
	};
}

async function requireThreadContext(
	getThreadContext: () => Promise<AIThreadContext | null>,
) {
	const thread = await getThreadContext();

	if (!thread) {
		throw new Error("Chat thread not found");
	}

	return thread;
}
