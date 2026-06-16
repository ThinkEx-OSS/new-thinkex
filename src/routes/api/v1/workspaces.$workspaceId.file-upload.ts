import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";

import { createDbContext } from "#/db/server";
import { requestWorkspaceFileExtraction } from "#/features/workspaces/extraction/request-workspace-file-extraction";
import { createWorkspaceFileFromUpload } from "#/features/workspaces/kernel/workspace-kernel-access";
import {
	assertCanMutateWorkspace,
	WorkspaceForbiddenError,
} from "#/features/workspaces/server/permissions";
import {
	getWorkspaceFileUploadValidationError,
	WorkspaceFileUploadError,
} from "#/features/workspaces/workspace-file-uploads";
import { apiError, apiJson, getRequestId } from "#/lib/api/http";
import { getSessionFromRequest } from "#/lib/auth-queries.server";

const fileFormKey = "file";
const parentIdFormKey = "parentId";
const clientMutationIdFormKey = "clientMutationId";

async function handleWorkspaceFileUpload(
	request: Request,
	workspaceId: string,
) {
	const requestId = getRequestId(request);
	let objectKey: string | null = null;

	try {
		const session = await getSessionFromRequest(request);

		if (!session) {
			return apiError(
				requestId,
				401,
				"UNAUTHORIZED",
				"You must be signed in to upload workspace files.",
			);
		}

		const dbContext = await createDbContext();

		try {
			await assertCanMutateWorkspace(dbContext.db, {
				workspaceId,
				userId: session.user.id,
			});
		} finally {
			await dbContext.dispose();
		}

		const formData = await request.formData();
		const file = formData.get(fileFormKey);

		if (!(file instanceof File)) {
			return apiError(
				requestId,
				400,
				"INVALID_UPLOAD",
				"File upload is missing a file.",
			);
		}

		const validationError = getWorkspaceFileUploadValidationError({
			fileName: file.name,
			sizeBytes: file.size,
			contentType: file.type,
		});

		if (validationError) {
			return apiError(
				requestId,
				validationError.status,
				validationError.code,
				validationError.message,
			);
		}

		objectKey = getWorkspaceFileUploadObjectKey(workspaceId);
		await env.WORKSPACE_KERNEL_FILES.put(objectKey, file, {
			httpMetadata: {
				contentType: file.type || "application/octet-stream",
			},
		});

		const command = await createWorkspaceFileFromUpload({
			workspaceId,
			userId: session.user.id,
			parentId: getNullableString(formData.get(parentIdFormKey)),
			fileName: file.name,
			fileSize: file.size,
			objectKey,
			contentType: file.type || null,
			clientMutationId: getNullableString(
				formData.get(clientMutationIdFormKey),
			),
		});

		objectKey = null;
		await requestFileExtractionAfterUpload({
			workspaceId,
			itemId: command.result.id,
			actorUserId: session.user.id,
		});

		return apiJson(command, requestId);
	} catch (error) {
		if (error instanceof WorkspaceForbiddenError) {
			return apiError(
				requestId,
				403,
				"FORBIDDEN",
				"You do not have permission to upload files to this workspace.",
			);
		}

		if (error instanceof WorkspaceFileUploadError) {
			return apiError(requestId, error.status, error.code, error.message);
		}

		return apiError(
			requestId,
			500,
			"UPLOAD_FAILED",
			"Unable to upload file right now.",
			error instanceof Error ? { message: error.message } : undefined,
		);
	} finally {
		if (objectKey) {
			await env.WORKSPACE_KERNEL_FILES.delete(objectKey);
		}
	}
}

export const Route = createFileRoute(
	"/api/v1/workspaces/$workspaceId/file-upload",
)({
	server: {
		handlers: {
			POST: ({ params, request }) =>
				handleWorkspaceFileUpload(request, params.workspaceId),
		},
	},
});

function getWorkspaceFileUploadObjectKey(workspaceId: string) {
	return `uploads/workspaces/${workspaceId}/${crypto.randomUUID()}/source`;
}

function getNullableString(value: FormDataEntryValue | null) {
	return typeof value === "string" && value.trim() ? value : null;
}

async function requestFileExtractionAfterUpload(input: {
	workspaceId: string;
	itemId: string;
	actorUserId: string;
}) {
	try {
		await requestWorkspaceFileExtraction(input);
	} catch (error) {
		console.warn(
			"[WorkspaceFileUpload] Uploaded file, but extraction could not be queued",
			error,
		);
	}
}

export { handleWorkspaceFileUpload };
