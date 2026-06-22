import { getDocumentSessionRoomName } from "#/features/workspaces/agent-routes";
import type { DocumentMarkdownEdit } from "#/features/workspaces/documents/document-markdown-edits";
import type { DocumentSessionApplyMarkdownEditsResult } from "#/features/workspaces/documents/document-session";
import {
	getWorkspaceKernelAiPageContext,
	resolveWorkspaceKernelAiExistingItemPath,
} from "#/features/workspaces/ai/workspace-kernel-ai-common";

interface DocumentSessionClient {
	applyMarkdownEdits(input: {
		edits: DocumentMarkdownEdit[];
	}): Promise<DocumentSessionApplyMarkdownEditsResult>;
}

type EditWorkspaceKernelAiFailureCode =
	| "cannot_edit_root"
	| "path_not_absolute"
	| "path_not_found"
	| "unsupported_item_type";

export interface EditWorkspaceKernelAiItemInput {
	edits: DocumentMarkdownEdit[];
	path: string;
	userId: string;
	workspaceId: string;
}

export async function editWorkspaceKernelAiItem(
	input: EditWorkspaceKernelAiItemInput,
): Promise<DocumentSessionApplyMarkdownEditsResult> {
	const context = await getWorkspaceKernelAiPageContext({
		access: "mutate",
		userId: input.userId,
		workspaceId: input.workspaceId,
	});
	const resolution = resolveWorkspaceKernelAiExistingItemPath({
		path: input.path,
		rootFailureCode: "cannot_edit_root",
		tree: context.tree,
	});

	if (resolution.status === "failed") {
		return failedWorkspaceAiEditResult(resolution.failure.code);
	}

	if (resolution.item.type !== "document") {
		return failedWorkspaceAiEditResult("unsupported_item_type");
	}

	const documentSession = await getDocumentSession({
		itemId: resolution.item.id,
		workspaceId: input.workspaceId,
	});

	return await documentSession.applyMarkdownEdits({
		edits: input.edits,
	});
}

async function getDocumentSession(input: {
	itemId: string;
	workspaceId: string;
}) {
	const { env } = await import("cloudflare:workers");
	const documentSessionNamespace = env.DocumentSession as unknown as {
		getByName(name: string): DocumentSessionClient;
	};

	return documentSessionNamespace.getByName(getDocumentSessionRoomName(input));
}

function failedWorkspaceAiEditResult(
	code: EditWorkspaceKernelAiFailureCode,
): DocumentSessionApplyMarkdownEditsResult {
	return {
		applied: 0,
		failed: 1,
		failures: [{ code, index: 0 }],
		status: "failed",
	};
}
