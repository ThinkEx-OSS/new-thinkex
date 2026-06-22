import type { ToolSet } from "ai";
import { tool } from "ai";
import { z } from "zod";

import type { AIThreadContext } from "#/features/workspaces/ai/ai-thread-metadata";
import { createWorkspaceKernelAiItems } from "#/features/workspaces/ai/workspace-kernel-ai-create";
import { deleteWorkspaceKernelAiItems } from "#/features/workspaces/ai/workspace-kernel-ai-delete";
import { editWorkspaceKernelAiItem } from "#/features/workspaces/ai/workspace-kernel-ai-edit";
import { moveWorkspaceKernelAiItems } from "#/features/workspaces/ai/workspace-kernel-ai-move";
import { readWorkspaceKernelAiItems } from "#/features/workspaces/ai/workspace-kernel-ai-read";
import { renameWorkspaceKernelAiItems } from "#/features/workspaces/ai/workspace-kernel-ai-rename";
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

const workspaceRenameItemsInputSchema = z.object({
	items: z
		.array(
			z.object({
				name: z
					.string()
					.trim()
					.min(1)
					.max(160)
					.describe("New user-visible item name."),
				path: z
					.string()
					.min(1)
					.describe(
						"Absolute path of one actual ThinkEx workspace item to rename.",
					),
			}),
		)
		.min(1)
		.max(20)
		.describe(
			"One or more actual ThinkEx workspace items to rename. Use a single array entry for a one-off rename.",
		),
});

const workspaceMoveItemsInputSchema = z.object({
	destinationPath: z
		.string()
		.min(1)
		.describe(
			"Absolute path of the destination folder. Use / for the workspace root.",
		),
	paths: z
		.array(z.string().min(1))
		.min(1)
		.max(20)
		.describe(
			"Absolute paths of one or more actual ThinkEx workspace items to move.",
		),
});

const workspaceCreateItemsInputSchema = z.object({
	items: z
		.array(
			z.discriminatedUnion("type", [
				z.object({
					type: z.literal("folder"),
					path: z
						.string()
						.min(1)
						.describe("Final absolute path for the folder to create."),
				}),
				z.object({
					type: z.literal("document"),
					path: z
						.string()
						.min(1)
						.describe("Final absolute path for the document to create."),
					initialContent: z
						.string()
						.describe("Optional initial Markdown content for the document.")
						.optional(),
				}),
			]),
		)
		.min(1)
		.max(20)
		.describe(
			"One or more folders or documents to create in order. Parent folders must already exist or be created earlier in the same request.",
		),
});

const workspaceDeleteItemsInputSchema = z.object({
	paths: z
		.array(z.string().min(1))
		.min(1)
		.max(20)
		.describe(
			"Absolute paths of one or more actual ThinkEx workspace items to delete.",
		),
});

function createInputExamples<T>(...inputs: T[]) {
	return inputs.map((input) => ({ input }));
}

const workspaceListItemsInputExamples = createInputExamples<
	z.input<typeof workspaceItemListInputSchema>
>({
	path: "/",
	limit: 50,
	recursive: false,
});
const workspaceReadItemsInputExamples = createInputExamples<
	z.input<typeof workspaceReadItemsInputSchema>
>({
	paths: ["/Demo Folder/Demo Document.md"],
	contentLimit: 200,
});
const workspaceRenameItemsInputExamples = createInputExamples<
	z.input<typeof workspaceRenameItemsInputSchema>
>({
	items: [
		{
			path: "/Demo Folder/Demo Document.md",
			name: "Tool Demo.md",
		},
	],
});
const workspaceMoveItemsInputExamples = createInputExamples<
	z.input<typeof workspaceMoveItemsInputSchema>
>({
	destinationPath: "/Archive",
	paths: ["/Demo Folder/Demo Document.md"],
});
const workspaceCreateItemsInputExamples = createInputExamples<
	z.input<typeof workspaceCreateItemsInputSchema>
>({
	items: [
		{
			type: "folder",
			path: "/Demo Folder",
		},
		{
			type: "document",
			path: "/Demo Folder/Demo Document.md",
			initialContent:
				"# Demo Document\nThis document was created as part of a tool demo.",
		},
	],
});
const workspaceDeleteItemsInputExamples = createInputExamples<
	z.input<typeof workspaceDeleteItemsInputSchema>
>({
	paths: ["/Demo Folder/Demo Document.md"],
});
const workspaceEditItemInputExamples = createInputExamples<
	z.input<typeof workspaceEditItemInputSchema>
>({
	path: "/Demo Folder/Demo Document.md",
	description: "Replace the document with updated demo content.",
	edits: [
		{
			type: "overwrite",
			content:
				"# Demo Document\nThis document was updated as part of the demo.",
		},
	],
});

export function createAIThreadWorkspaceTools(input: {
	getThreadContext: () => Promise<AIThreadContext | null>;
}): ToolSet {
	return {
		workspace_list_items: tool({
			description:
				"List items in the actual ThinkEx workspace by absolute path.",
			inputSchema: workspaceItemListInputSchema,
			inputExamples: workspaceListItemsInputExamples,
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
				"Read actual ThinkEx workspace items by absolute path. Documents return Markdown. Folders return listings. Other files return extracted text when available or a status result. Use contentOffset to continue when page.next is present.",
			inputSchema: workspaceReadItemsInputSchema,
			inputExamples: workspaceReadItemsInputExamples,
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
		workspace_rename_items: tool({
			description:
				"Rename one or more actual ThinkEx workspace items by absolute path. If the requested final path already exists, that rename fails instead of auto-renaming.",
			inputSchema: workspaceRenameItemsInputSchema,
			inputExamples: workspaceRenameItemsInputExamples,
			execute: async ({ items }) => {
				const thread = await requireThreadContext(input.getThreadContext);

				return await renameWorkspaceKernelAiItems({
					items,
					workspaceId: thread.workspaceId,
					userId: thread.userId,
				});
			},
		}),
		workspace_move_items: tool({
			description:
				"Move one or more actual ThinkEx workspace items into an existing folder or the workspace root. If the destination already has the same name, that move fails instead of auto-renaming.",
			inputSchema: workspaceMoveItemsInputSchema,
			inputExamples: workspaceMoveItemsInputExamples,
			execute: async ({ destinationPath, paths }) => {
				const thread = await requireThreadContext(input.getThreadContext);

				return await moveWorkspaceKernelAiItems({
					destinationPath,
					paths,
					workspaceId: thread.workspaceId,
					userId: thread.userId,
				});
			},
		}),
		workspace_create_items: tool({
			description:
				"Create one or more folders or documents at exact absolute paths. If a path already exists, creation fails instead of renaming.",
			inputSchema: workspaceCreateItemsInputSchema,
			inputExamples: workspaceCreateItemsInputExamples,
			execute: async ({ items }) => {
				const thread = await requireThreadContext(input.getThreadContext);

				return await createWorkspaceKernelAiItems({
					items,
					workspaceId: thread.workspaceId,
					userId: thread.userId,
				});
			},
		}),
		workspace_delete_items: tool({
			description:
				"Delete one or more actual ThinkEx workspace items by absolute path.",
			inputSchema: workspaceDeleteItemsInputSchema,
			inputExamples: workspaceDeleteItemsInputExamples,
			execute: async ({ paths }) => {
				const thread = await requireThreadContext(input.getThreadContext);

				return await deleteWorkspaceKernelAiItems({
					paths,
					workspaceId: thread.workspaceId,
					userId: thread.userId,
				});
			},
		}),
		workspace_edit_item: tool({
			description:
				"Edit one actual ThinkEx workspace document by absolute path. Read before editing unless the user requested a simple append or prepend.",
			inputSchema: workspaceEditItemInputSchema,
			inputExamples: workspaceEditItemInputExamples,
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
