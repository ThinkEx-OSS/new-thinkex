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
import { workspaceItemTypeSchema } from "#/features/workspaces/contracts";
import { documentMarkdownEditSchema } from "#/features/workspaces/documents/document-markdown-edits";
import { listWorkspaceKernelItems } from "#/features/workspaces/kernel/workspace-kernel-access";

const workspacePathSchema = z.string().min(1);
const workspaceIndexSchema = z.number().int().nonnegative();

function createInputExamples<T>(...inputs: T[]) {
	return inputs.map((input) => ({ input }));
}

function createFailureSchema<const TCodes extends [string, ...string[]]>(
	codes: TCodes,
	options?: { includeIndex?: boolean },
) {
	return z.object({
		code: z.enum(codes),
		path: workspacePathSchema,
		...(options?.includeIndex === false
			? {}
			: {
					index: workspaceIndexSchema,
				}),
	});
}

const workspacePathItemSchema = z.object({
	path: workspacePathSchema,
	type: workspaceItemTypeSchema,
});

const workspacePagedContentSchema = z.object({
	lineTruncated: z.boolean().optional(),
	next: z.number().int().min(1).optional(),
	truncated: z.boolean(),
});

const workspaceListItemsInputSchema = z.object({
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
		.describe("Include nested descendants. Defaults to false for immediate children only."),
});

const workspaceReadItemsInputSchema = z.object({
	contentLimit: z
		.number()
		.int()
		.min(1)
		.max(2000)
		.optional()
		.describe(
			"Maximum Markdown lines to return for documents and extracted files. Defaults to 2000.",
		),
	contentOffset: z
		.number()
		.int()
		.min(1)
		.optional()
		.describe(
			"1-based Markdown line offset for documents and extracted files. Use the returned page.next value to continue.",
		),
	paths: z
		.array(z.string().min(1))
		.min(1)
		.max(20)
		.describe("Absolute paths in the actual ThinkEx workspace to read."),
});

const workspaceEditItemInputSchema = z.object({
	path: z.string().min(1).describe("Absolute path of one actual ThinkEx workspace item to edit."),
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
				name: z.string().trim().min(1).max(160).describe("New user-visible item name."),
				path: z
					.string()
					.min(1)
					.describe("Absolute path of one actual ThinkEx workspace item to rename."),
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
		.describe("Absolute path of the destination folder. Use / for the workspace root."),
	paths: z
		.array(z.string().min(1))
		.min(1)
		.max(20)
		.describe("Absolute paths of one or more actual ThinkEx workspace items to move."),
});

const workspaceCreateItemsInputSchema = z.object({
	items: z
		.array(
			z.discriminatedUnion("type", [
				z.object({
					type: z.literal("folder"),
					path: z.string().min(1).describe("Final absolute path for the folder to create."),
				}),
				z.object({
					type: z.literal("document"),
					path: z.string().min(1).describe("Final absolute path for the document to create."),
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
		.describe("Absolute paths of one or more actual ThinkEx workspace items to delete."),
});

const workspaceListItemsInputExamples = createInputExamples<
	z.input<typeof workspaceListItemsInputSchema>
>({
	path: "/",
	limit: 50,
	recursive: false,
});

const workspaceReadItemsInputExamples = createInputExamples<
	z.input<typeof workspaceReadItemsInputSchema>
>({
	paths: ["/Demo Folder/Demo Document"],
	contentLimit: 200,
});

const workspaceRenameItemsInputExamples = createInputExamples<
	z.input<typeof workspaceRenameItemsInputSchema>
>({
	items: [
		{
			path: "/Demo Folder/Demo Document",
			name: "Tool Demo",
		},
	],
});

const workspaceMoveItemsInputExamples = createInputExamples<
	z.input<typeof workspaceMoveItemsInputSchema>
>({
	destinationPath: "/Archive",
	paths: ["/Demo Folder/Demo Document"],
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
			path: "/Demo Folder/Demo Document",
			initialContent: "# Demo Document\nThis document was created as part of a tool demo.",
		},
	],
});

const workspaceDeleteItemsInputExamples = createInputExamples<
	z.input<typeof workspaceDeleteItemsInputSchema>
>({
	paths: ["/Demo Folder/Demo Document"],
});

const workspaceEditItemInputExamples = createInputExamples<
	z.input<typeof workspaceEditItemInputSchema>
>({
	path: "/Demo Folder/Demo Document",
	edits: [
		{
			type: "overwrite",
			content: "# Demo Document\nThis document was updated as part of the demo.",
		},
	],
});

const workspaceListItemsOutputSchema = z.object({
	path: workspacePathSchema,
	more: z.boolean(),
	items: z.array(workspacePathItemSchema),
	failed: z.array(
		createFailureSchema(["path_not_absolute", "path_not_folder", "path_not_found"], {
			includeIndex: false,
		}),
	),
});

const workspaceReadItemsOutputSchema = z.object({
	items: z.array(
		z.object({
			path: workspacePathSchema,
			type: z.enum(["document", "file", "flashcard", "quiz"]),
			status: z.enum(["failed", "pending", "ready", "unsupported"]),
			content: z.string().optional(),
			page: workspacePagedContentSchema.optional(),
		}),
	),
	failed: z.array(
		createFailureSchema([
			"content_offset_out_of_range",
			"path_is_folder",
			"path_not_absolute",
			"path_not_found",
		]),
	),
});

const workspaceCreateItemsOutputSchema = z.object({
	items: z.array(
		z.object({
			path: workspacePathSchema,
			type: z.enum(["document", "folder"]),
		}),
	),
	failed: z.array(
		createFailureSchema([
			"cannot_create_root",
			"invalid_initial_content",
			"path_already_exists",
			"path_not_absolute",
			"path_not_canonical",
			"path_not_folder",
			"path_not_found",
		]),
	),
});

const workspaceDeleteItemsOutputSchema = z.object({
	items: z.array(workspacePathItemSchema),
	failed: z.array(
		createFailureSchema(["cannot_delete_root", "path_not_absolute", "path_not_found"]),
	),
});

const workspaceMoveItemsOutputSchema = z.object({
	items: z.array(
		workspacePathItemSchema.extend({
			previousPath: workspacePathSchema,
		}),
	),
	failed: z.array(
		createFailureSchema(
			[
				"already_in_destination",
				"cannot_move_into_descendant",
				"cannot_move_root",
				"destination_path_not_absolute",
				"destination_path_not_folder",
				"destination_path_not_found",
				"path_already_exists",
				"path_not_absolute",
				"path_not_found",
			],
			{ includeIndex: false },
		).extend({
			index: workspaceIndexSchema.optional(),
		}),
	),
});

const workspaceRenameItemsOutputSchema = z.object({
	items: z.array(
		workspacePathItemSchema.extend({
			previousPath: workspacePathSchema,
		}),
	),
	failed: z.array(
		createFailureSchema([
			"cannot_rename_root",
			"path_already_exists",
			"path_not_absolute",
			"path_not_found",
		]),
	),
});

const workspaceEditItemOutputSchema = z.object({
	path: workspacePathSchema,
	applied: z.number().int().min(0),
	failed: z.array(
		z.object({
			code: z.string(),
			index: workspaceIndexSchema,
		}),
	),
});

type WorkspaceThreadToolConfig<
	TInputSchema extends z.ZodTypeAny,
	TOutputSchema extends z.ZodTypeAny,
> = {
	description: string;
	execute: (
		args: z.output<TInputSchema>,
		thread: AIThreadContext,
	) => Promise<z.output<TOutputSchema>>;
	getThreadContext: () => Promise<AIThreadContext | null>;
	inputExamples: Array<{ input: z.input<TInputSchema> }>;
	inputSchema: TInputSchema;
	outputSchema: TOutputSchema;
};

function createWorkspaceThreadTool<
	TInputSchema extends z.ZodTypeAny,
	TOutputSchema extends z.ZodTypeAny,
>(input: WorkspaceThreadToolConfig<TInputSchema, TOutputSchema>) {
	return tool({
		description: input.description,
		inputSchema: input.inputSchema,
		inputExamples: input.inputExamples,
		outputSchema: input.outputSchema,
		strict: true,
		execute: async (args) => {
			return await input.execute(
				args as z.output<TInputSchema>,
				await requireThreadContext(input.getThreadContext),
			);
		},
	});
}

export function createAIThreadWorkspaceTools(input: {
	getThreadContext: () => Promise<AIThreadContext | null>;
}): ToolSet {
	const createThreadTool = <TInputSchema extends z.ZodTypeAny, TOutputSchema extends z.ZodTypeAny>(
		config: Omit<WorkspaceThreadToolConfig<TInputSchema, TOutputSchema>, "getThreadContext">,
	) => {
		return createWorkspaceThreadTool({
			...config,
			getThreadContext: input.getThreadContext,
		});
	};

	return {
		workspace_list_items: createThreadTool({
			description: "List items in the actual ThinkEx workspace by absolute path.",
			inputSchema: workspaceListItemsInputSchema,
			inputExamples: workspaceListItemsInputExamples,
			outputSchema: workspaceListItemsOutputSchema,
			execute: async ({ limit, path, recursive }, thread) => {
				return await listWorkspaceKernelItems({
					workspaceId: thread.workspaceId,
					userId: thread.userId,
					path,
					recursive,
					limit,
				});
			},
		}),
		workspace_read_items: createThreadTool({
			description:
				"Read actual ThinkEx documents and files by absolute path. Use workspace_list_items for folders. Use contentOffset to continue when page.next is present.",
			inputSchema: workspaceReadItemsInputSchema,
			inputExamples: workspaceReadItemsInputExamples,
			outputSchema: workspaceReadItemsOutputSchema,
			execute: async ({ contentLimit, contentOffset, paths }, thread) => {
				return await readWorkspaceKernelAiItems({
					contentLimit,
					contentOffset,
					workspaceId: thread.workspaceId,
					userId: thread.userId,
					paths,
				});
			},
		}),
		workspace_rename_items: createThreadTool({
			description:
				"Rename one or more actual ThinkEx workspace items by absolute path. If the requested final path already exists, that rename fails instead of auto-renaming.",
			inputSchema: workspaceRenameItemsInputSchema,
			inputExamples: workspaceRenameItemsInputExamples,
			outputSchema: workspaceRenameItemsOutputSchema,
			execute: async ({ items }, thread) => {
				return await renameWorkspaceKernelAiItems({
					items,
					workspaceId: thread.workspaceId,
					userId: thread.userId,
				});
			},
		}),
		workspace_move_items: createThreadTool({
			description:
				"Move one or more actual ThinkEx workspace items into an existing folder or the workspace root. If the destination already has the same name, that move fails instead of auto-renaming.",
			inputSchema: workspaceMoveItemsInputSchema,
			inputExamples: workspaceMoveItemsInputExamples,
			outputSchema: workspaceMoveItemsOutputSchema,
			execute: async ({ destinationPath, paths }, thread) => {
				return await moveWorkspaceKernelAiItems({
					destinationPath,
					paths,
					workspaceId: thread.workspaceId,
					userId: thread.userId,
				});
			},
		}),
		workspace_create_items: createThreadTool({
			description:
				"Create one or more folders or documents at exact absolute paths. If a path already exists, creation fails instead of renaming.",
			inputSchema: workspaceCreateItemsInputSchema,
			inputExamples: workspaceCreateItemsInputExamples,
			outputSchema: workspaceCreateItemsOutputSchema,
			execute: async ({ items }, thread) => {
				return await createWorkspaceKernelAiItems({
					items,
					workspaceId: thread.workspaceId,
					userId: thread.userId,
				});
			},
		}),
		workspace_delete_items: createThreadTool({
			description: "Delete one or more actual ThinkEx workspace items by absolute path.",
			inputSchema: workspaceDeleteItemsInputSchema,
			inputExamples: workspaceDeleteItemsInputExamples,
			outputSchema: workspaceDeleteItemsOutputSchema,
			execute: async ({ paths }, thread) => {
				return await deleteWorkspaceKernelAiItems({
					paths,
					workspaceId: thread.workspaceId,
					userId: thread.userId,
				});
			},
		}),
		workspace_edit_item: createThreadTool({
			description:
				"Edit one actual ThinkEx workspace document by absolute path. Read before editing unless the user requested a simple append or prepend.",
			inputSchema: workspaceEditItemInputSchema,
			inputExamples: workspaceEditItemInputExamples,
			outputSchema: workspaceEditItemOutputSchema,
			execute: async ({ path, edits }, thread) => {
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

async function requireThreadContext(getThreadContext: () => Promise<AIThreadContext | null>) {
	const thread = await getThreadContext();

	if (!thread) {
		throw new Error("Chat thread not found");
	}

	return thread;
}
