import { getDocumentSessionRoomName } from "#/features/workspaces/agent-routes";
import {
	getWorkspaceKernelAiPageContext,
	resolveWorkspaceKernelAiExistingItemPath,
} from "#/features/workspaces/ai/workspace-kernel-ai-common";
import type { DocumentMarkdownEdit } from "#/features/workspaces/documents/document-markdown-edits";
import type { DocumentSessionApplyMarkdownEditsResult } from "#/features/workspaces/documents/document-session";

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

type EditWorkspaceKernelAiFailure = DocumentSessionApplyMarkdownEditsResult["failures"][number];

export interface EditWorkspaceKernelAiItemResult {
	applied: number;
	failed: EditWorkspaceKernelAiFailure[];
	path: string;
}

export async function editWorkspaceKernelAiItem(
	input: EditWorkspaceKernelAiItemInput,
): Promise<EditWorkspaceKernelAiItemResult> {
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
		return {
			path: resolution.failure.path,
			...failedWorkspaceAiEditResult(resolution.failure.code, input.edits.length),
		};
	}

	if (resolution.item.type !== "document") {
		return {
			path: resolution.path,
			...failedWorkspaceAiEditResult("unsupported_item_type", input.edits.length),
		};
	}

	const documentSession = await getDocumentSession({
		itemId: resolution.item.id,
		workspaceId: input.workspaceId,
	});

	const result = await documentSession.applyMarkdownEdits({
		edits: input.edits,
	});

	return {
		applied: result.applied,
		failed: result.failures,
		path: resolution.path,
	};
}

async function getDocumentSession(input: { itemId: string; workspaceId: string }) {
	const { env } = await import("cloudflare:workers");
	const documentSessionNamespace = env.DocumentSession as unknown as {
		getByName(name: string): DocumentSessionClient;
	};

	return documentSessionNamespace.getByName(getDocumentSessionRoomName(input));
}

function failedWorkspaceAiEditResult(
	code: EditWorkspaceKernelAiFailureCode,
	editCount: number,
): Pick<EditWorkspaceKernelAiItemResult, "applied" | "failed"> {
	return {
		applied: 0,
		failed: Array.from({ length: editCount }, (_, index) => ({
			code,
			index,
		})),
	};
}
