import { z } from "zod";

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([
		z.string(),
		z.number(),
		z.boolean(),
		z.null(),
		z.array(jsonValueSchema),
		z.record(z.string(), jsonValueSchema),
	]),
);

export const workspaceIconSchema = z.enum([
	"compass",
	"flask-conical",
	"zap",
	"book-marked",
]);

export const workspaceColorSchema = z.enum([
	"sky",
	"violet",
	"amber",
	"emerald",
]);

export const workspaceSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	icon: workspaceIconSchema.nullable(),
	color: workspaceColorSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	lastOpenedAt: z.string().nullable(),
	archivedAt: z.string().nullable(),
});

export const workspaceItemTypeSchema = z.enum([
	"folder",
	"document",
	"file",
	"flashcard",
	"quiz",
]);

export const workspaceItemSummarySchema = z.object({
	id: z.string(),
	workspaceId: z.string(),
	parentId: z.string().nullable(),
	type: workspaceItemTypeSchema,
	title: z.string(),
	name: z.string(),
	meta: z.string(),
	color: z.string().nullable(),
	metadataJson: z.record(z.string(), jsonValueSchema),
	sortOrder: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
});

export const createWorkspaceItemInputSchema = z.object({
	id: z.uuid().optional(),
	workspaceId: z.string().min(1),
	parentId: z.string().min(1).nullable().optional(),
	type: workspaceItemTypeSchema,
	name: z.string().trim().min(1).max(160).optional(),
	clientMutationId: z.uuid().optional(),
});

export const renameWorkspaceItemInputSchema = z.object({
	workspaceId: z.string().min(1),
	itemId: z.string().min(1),
	name: z.string().trim().min(1).max(160),
	clientMutationId: z.uuid().optional(),
});

export const moveWorkspaceItemInputSchema = z.object({
	workspaceId: z.string().min(1),
	itemId: z.string().min(1),
	parentId: z.string().min(1).nullable().optional(),
	sortOrder: z.number().int().optional(),
	clientMutationId: z.uuid().optional(),
});

export const deleteWorkspaceItemInputSchema = z.object({
	workspaceId: z.string().min(1),
	itemId: z.string().min(1),
	clientMutationId: z.uuid().optional(),
});

export const createWorkspaceInputSchema = z.object({
	id: z.uuid().optional(),
	name: z.string().trim().min(1).max(120).optional(),
	color: workspaceColorSchema.nullable().optional(),
});

export const updateWorkspaceInputSchema = z.object({
	workspaceId: z.string().min(1),
	name: z.string().trim().min(1).max(120),
	icon: workspaceIconSchema,
	color: workspaceColorSchema,
});

export const deleteWorkspaceInputSchema = z.object({
	workspaceId: z.string().min(1),
	confirmationName: z.string().trim().min(1),
});

export const workspacePageSchema = z.object({
	workspace: workspaceSummarySchema,
	items: z.array(workspaceItemSummarySchema),
	revision: z.number().int().nonnegative(),
});

export type WorkspaceIcon = z.infer<typeof workspaceIconSchema>;
export type WorkspaceColor = z.infer<typeof workspaceColorSchema>;
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
export type WorkspaceDetail = WorkspaceSummary;
export type WorkspaceItemType = z.infer<typeof workspaceItemTypeSchema>;
export type WorkspaceItemSummary = z.infer<typeof workspaceItemSummarySchema>;
export type CreateWorkspaceItemInput = z.infer<
	typeof createWorkspaceItemInputSchema
>;
export type RenameWorkspaceItemInput = z.infer<
	typeof renameWorkspaceItemInputSchema
>;
export type MoveWorkspaceItemInput = z.infer<
	typeof moveWorkspaceItemInputSchema
>;
export type DeleteWorkspaceItemInput = z.infer<
	typeof deleteWorkspaceItemInputSchema
>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInputSchema>;
export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceInputSchema>;
export type WorkspacePage = z.infer<typeof workspacePageSchema>;
