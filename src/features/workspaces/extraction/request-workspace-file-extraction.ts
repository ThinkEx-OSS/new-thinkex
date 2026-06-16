import { env } from "cloudflare:workers";

import { sha256Base64UrlText } from "#/features/workspaces/extraction/binary";
import type { WorkspaceFileExtractionWorkflowParams } from "#/features/workspaces/extraction/types";
import { getWorkspaceKernel } from "#/features/workspaces/kernel/workspace-kernel-access";

export async function requestWorkspaceFileExtraction(input: {
	workspaceId: string;
	itemId: string;
	actorUserId: string | null;
}) {
	const kernel = await getWorkspaceKernel(input.workspaceId);
	const workflowId = await getWorkspaceFileExtractionWorkflowId(input);
	const params = {
		workspaceId: input.workspaceId,
		itemId: input.itemId,
		actorUserId: input.actorUserId,
	} satisfies WorkspaceFileExtractionWorkflowParams;

	await kernel.upsertFileProjection({
		itemId: input.itemId,
		format: "markdown",
		status: "queued",
		actorUserId: input.actorUserId,
	});

	try {
		const [instance] = await env.WORKSPACE_FILE_EXTRACTION_WORKFLOW.createBatch(
			[
				{
					id: workflowId,
					params,
				},
			],
		);

		return { workflowId, queued: Boolean(instance) };
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to queue extraction.";
		await kernel.upsertFileProjection({
			itemId: input.itemId,
			format: "markdown",
			status: "failed",
			errorMessage,
			actorUserId: input.actorUserId,
		});

		throw error;
	}
}

async function getWorkspaceFileExtractionWorkflowId(input: {
	workspaceId: string;
	itemId: string;
}) {
	const digest = await sha256Base64UrlText(
		`${input.workspaceId}:${input.itemId}:pdf-extraction:v1`,
	);

	return `pdf-${digest.slice(0, 48)}`;
}
