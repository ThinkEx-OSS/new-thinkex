import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";

import { createDbContext } from "#/db/server";
import {
	convertOfficeFileToPdf,
	OfficePdfConversionError,
} from "#/features/workspaces/conversion/office-pdf-converter";
import { requestWorkspaceFileExtraction } from "#/features/workspaces/extraction/request-workspace-file-extraction";
import { createWorkspaceFileFromUpload } from "#/features/workspaces/kernel/workspace-kernel-access";
import {
	getWorkspaceConvertedPdfFileName,
	getWorkspaceFileUploadValidationError,
	requireWorkspaceFileTypeFromHint,
	requiresWorkspaceFilePdfConversion,
	resolveWorkspaceFileAiReadStrategy,
	WorkspaceFileUploadError,
	type WorkspaceFileTypeDescriptor,
} from "#/features/workspaces/model/workspace-file";
import {
	assertCanMutateWorkspace,
	WorkspaceForbiddenError,
} from "#/features/workspaces/server/permissions";
import { apiError, apiJson, getRequestId } from "#/lib/api/http";
import { getSessionFromRequest } from "#/lib/auth-queries.server";

const fileFormKey = "file";
const parentIdFormKey = "parentId";
const clientMutationIdFormKey = "clientMutationId";

async function handleWorkspaceFileUpload(request: Request, workspaceId: string) {
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
			return apiError(requestId, 400, "INVALID_UPLOAD", "File upload is missing a file.");
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

		const descriptor = requireWorkspaceFileTypeFromHint({
			fileName: file.name,
			contentType: file.type,
		});
		const upload = await prepareWorkspaceFileUpload({
			descriptor,
			env,
			file,
		});

		objectKey = getWorkspaceFileUploadObjectKey(workspaceId);
		await env.WORKSPACE_KERNEL_FILES.put(objectKey, upload.body, {
			httpMetadata: {
				contentType: upload.contentType,
			},
		});

		const command = await createWorkspaceFileFromUpload({
			workspaceId,
			userId: session.user.id,
			parentId: getNullableString(formData.get(parentIdFormKey)),
			fileName: upload.fileName,
			fileSize: upload.fileSize,
			objectKey,
			contentType: upload.contentType,
			assetKind: upload.descriptor.assetKind,
			clientMutationId: getNullableString(formData.get(clientMutationIdFormKey)),
		});

		objectKey = null;
		if (
			resolveWorkspaceFileAiReadStrategy({
				fileName: upload.fileName,
				contentType: upload.contentType,
				descriptor: upload.descriptor,
			}) === "markdown_extraction"
		) {
			try {
				await requestWorkspaceFileExtraction({
					workspaceId,
					itemId: command.result.id,
					actorUserId: session.user.id,
					assetKind: upload.descriptor.assetKind,
				});
			} catch (error) {
				console.warn(
					"[WorkspaceFileUpload] Uploaded file, but extraction could not be queued",
					error,
				);
			}
		}

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

		if (error instanceof OfficePdfConversionError) {
			return apiError(
				requestId,
				422,
				"CONVERSION_FAILED",
				"Unable to convert this file to PDF right now.",
				{ message: error.message },
			);
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

export const Route = createFileRoute("/api/v1/workspaces/$workspaceId/file-upload")({
	server: {
		handlers: {
			POST: ({ params, request }) => handleWorkspaceFileUpload(request, params.workspaceId),
		},
	},
});

function getWorkspaceFileUploadObjectKey(workspaceId: string) {
	return `uploads/workspaces/${workspaceId}/${crypto.randomUUID()}/source`;
}

async function prepareWorkspaceFileUpload(input: {
	descriptor: WorkspaceFileTypeDescriptor;
	env: Env;
	file: File;
}): Promise<{
	body: ArrayBuffer | File;
	contentType: string;
	descriptor: WorkspaceFileTypeDescriptor;
	fileName: string;
	fileSize: number;
}> {
	if (
		!requiresWorkspaceFilePdfConversion({
			fileName: input.file.name,
			contentType: input.file.type,
		})
	) {
		return {
			body: input.file,
			contentType: input.file.type || "application/octet-stream",
			descriptor: input.descriptor,
			fileName: input.file.name,
			fileSize: input.file.size,
		};
	}

	const conversion = await convertOfficeFileToPdf(input.env, {
		file: input.file,
		fileName: input.file.name,
	});
	const pdfFileName = getWorkspaceConvertedPdfFileName(input.file.name);
	const pdfDescriptor = requireWorkspaceFileTypeFromHint({
		fileName: pdfFileName,
		contentType: conversion.contentType,
	});

	return {
		body: conversion.bytes,
		contentType: conversion.contentType,
		descriptor: pdfDescriptor,
		fileName: pdfFileName,
		fileSize: conversion.sizeBytes,
	};
}

function getNullableString(value: FormDataEntryValue | null) {
	return typeof value === "string" && value.trim() ? value : null;
}

export { handleWorkspaceFileUpload };
