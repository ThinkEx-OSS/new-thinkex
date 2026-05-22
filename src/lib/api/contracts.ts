import { z } from "zod";

export const workspaceIconSchema = z.enum([
	"compass",
	"flask-conical",
	"zap",
	"book-marked",
]);

export const workspaceAccentSchema = z.enum([
	"sky",
	"violet",
	"amber",
	"emerald",
]);

export const workspaceSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	icon: workspaceIconSchema,
	accent: workspaceAccentSchema,
	updatedAt: z.string(),
	status: z.enum(["draft", "ready"]),
});

export const workspaceListResponseSchema = z.object({
	workspaces: z.array(workspaceSummarySchema),
});

export const apiErrorSchema = z.object({
	requestId: z.string(),
	code: z.string(),
	message: z.string(),
	details: z.unknown().optional(),
});

export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
export type WorkspaceAccent = z.infer<typeof workspaceAccentSchema>;
export type WorkspaceListResponse = z.infer<typeof workspaceListResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
