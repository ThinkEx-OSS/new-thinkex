import { z } from "zod";

export const workspaceSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
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
export type WorkspaceListResponse = z.infer<typeof workspaceListResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
