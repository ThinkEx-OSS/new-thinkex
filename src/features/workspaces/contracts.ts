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

export const workspaceIconValues = [
	"book-marked",
	"book-open",
	"book-open-text",
	"book-search",
	"graduation-cap",
	"library-big",
	"school",
	"notebook-pen",
	"notebook-tabs",
	"highlighter",
	"file-text",
	"file-chart-column",
	"folder-open",
	"folder-search",
	"archive",
	"clipboard-list",
	"kanban",
	"list-todo",
	"presentation",
	"calendar-days",
	"clock-3",
	"target",
	"lightbulb",
	"brain",
	"brain-circuit",
	"compass",
	"map",
	"globe-2",
	"languages",
	"scroll-text",
	"newspaper",
	"palette",
	"swatch-book",
	"pen-tool",
	"pencil-ruler",
	"music",
	"audio-lines",
	"mic",
	"headphones",
	"camera",
	"video",
	"theater",
	"scale",
	"gavel",
	"vote",
	"landmark",
	"message-square-text",
	"users",
	"helping-hand",
	"handshake",
	"hand-coins",
	"briefcase-business",
	"building-2",
	"chart-column",
	"chart-line",
	"chart-scatter",
	"chart-gantt",
	"chart-pie",
	"banknote",
	"piggy-bank",
	"receipt-text",
	"megaphone",
	"wallet-cards",
	"store",
	"factory",
	"truck",
	"package",
	"shield-check",
	"search-check",
	"atom",
	"orbit",
	"magnet",
	"flask-conical",
	"test-tube-diagonal",
	"microscope",
	"activity",
	"dna",
	"sigma",
	"calculator",
	"ruler",
	"drafting-compass",
	"cpu",
	"circuit-board",
	"binary",
	"database",
	"bot",
	"code-2",
	"wrench",
	"stethoscope",
	"hospital",
	"heart-pulse",
	"pill",
	"pill-bottle",
	"leaf",
	"sprout",
	"earth",
	"waves",
	"droplet",
	"thermometer",
	"flame",
	"mountain",
	"cloud-sun",
	"telescope",
	"rocket",
	"satellite",
	"zap",
] as const;

export const workspaceIconSchema = z.enum(workspaceIconValues);

export const workspaceColorValues = [
	"red-soft",
	"red",
	"red-bold",
	"red-deep",
	"orange-soft",
	"orange",
	"orange-bold",
	"orange-deep",
	"amber-soft",
	"amber",
	"amber-bold",
	"amber-deep",
	"emerald-soft",
	"emerald",
	"emerald-bold",
	"emerald-deep",
	"teal-soft",
	"teal",
	"teal-bold",
	"teal-deep",
	"sky-soft",
	"sky",
	"sky-bold",
	"sky-deep",
	"violet-soft",
	"violet",
	"violet-bold",
	"violet-deep",
	"rose-soft",
	"rose",
	"rose-bold",
	"rose-deep",
] as const;

export const workspaceColorSchema = z.enum(workspaceColorValues);

export const workspaceItemColorSchema = workspaceColorSchema;

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
	color: workspaceItemColorSchema.optional(),
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

export const updateWorkspaceItemColorInputSchema = z.object({
	workspaceId: z.string().min(1),
	itemId: z.string().min(1),
	color: workspaceItemColorSchema,
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
export type WorkspaceItemColor = z.infer<typeof workspaceItemColorSchema>;
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
export type UpdateWorkspaceItemColorInput = z.infer<
	typeof updateWorkspaceItemColorInputSchema
>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInputSchema>;
export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceInputSchema>;
export type WorkspacePage = z.infer<typeof workspacePageSchema>;
