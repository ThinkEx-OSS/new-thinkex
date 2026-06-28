import {
	importThinkexDocumentItem,
	importThinkexFileItem,
	importThinkexFolderItem,
	importThinkexUser,
	importThinkexWorkspace,
	importThinkexWorkspaceMember,
} from "#/features/workspaces/migration/thinkex-migration-import.server";
import { isAuthorizedThinkexMigrationRequest } from "#/features/workspaces/migration/thinkex-migration-auth";
import type {
	ThinkexMigrationCommandEnvelope,
	ThinkexMigrationImportFileItemInput,
} from "#/features/workspaces/migration/thinkex-migration-types";
import { apiError, apiJson, getRequestId } from "#/lib/api/http";

const thinkexMigrationPath = "/api/v1/admin/thinkex-migration";
const thinkexMigrationFilePath = `${thinkexMigrationPath}/file`;
const metadataFormKey = "metadata";
const fileFormKey = "file";

export async function routeThinkexMigrationRequest(request: Request) {
	const pathname = new URL(request.url).pathname;

	if (request.method !== "POST") {
		return null;
	}

	if (pathname === thinkexMigrationPath) {
		return handleThinkexMigrationCommand(request);
	}

	if (pathname === thinkexMigrationFilePath) {
		return handleThinkexMigrationFileImport(request);
	}

	return null;
}

async function handleThinkexMigrationCommand(request: Request) {
	const requestId = getRequestId(request);

	if (!isAuthorizedThinkexMigrationRequest(request)) {
		return apiError(requestId, 401, "UNAUTHORIZED", "Migration token is required.");
	}

	try {
		const body = (await request.json()) as ThinkexMigrationCommandEnvelope;

		switch (body.command.type) {
			case "import_user":
				await importThinkexUser(body.command.input);
				return apiJson({ ok: true }, requestId);
			case "import_workspace":
				return apiJson(await importThinkexWorkspace(body.command.input), requestId);
			case "import_workspace_member":
				await importThinkexWorkspaceMember(body.command.input);
				return apiJson({ ok: true }, requestId);
			case "import_folder_item":
				return apiJson({ item: await importThinkexFolderItem(body.command.input) }, requestId);
			case "import_document_item":
				return apiJson({ item: await importThinkexDocumentItem(body.command.input) }, requestId);
			case "import_file_item":
				return apiError(
					requestId,
					400,
					"INVALID_COMMAND",
					"File imports must use the multipart migration file endpoint.",
				);
		}
	} catch (error) {
		return apiError(
			requestId,
			500,
			"MIGRATION_COMMAND_FAILED",
			"Unable to process migration command.",
			error instanceof Error ? { message: error.message } : undefined,
		);
	}
}

async function handleThinkexMigrationFileImport(request: Request) {
	const requestId = getRequestId(request);

	if (!isAuthorizedThinkexMigrationRequest(request)) {
		return apiError(requestId, 401, "UNAUTHORIZED", "Migration token is required.");
	}

	try {
		const formData = await request.formData();
		const metadata = formData.get(metadataFormKey);
		const file = formData.get(fileFormKey);

		if (typeof metadata !== "string") {
			return apiError(requestId, 400, "INVALID_INPUT", "Migration file metadata is required.");
		}

		if (!(file instanceof File)) {
			return apiError(requestId, 400, "INVALID_INPUT", "Migration file payload is required.");
		}

		const input = JSON.parse(metadata) as ThinkexMigrationImportFileItemInput;
		const item = await importThinkexFileItem({
			...input,
			bytes: new Uint8Array(await file.arrayBuffer()),
		});

		return apiJson({ item }, requestId);
	} catch (error) {
		return apiError(
			requestId,
			500,
			"MIGRATION_FILE_IMPORT_FAILED",
			"Unable to import migration file.",
			error instanceof Error ? { message: error.message } : undefined,
		);
	}
}
