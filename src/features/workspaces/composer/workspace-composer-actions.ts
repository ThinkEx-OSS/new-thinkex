import { WORKSPACE_AI_CHAT_ATTACHMENT_POLICY } from "#/features/workspaces/components/ai-chat/constants";
import type { WorkspaceSelectedQuote } from "#/features/workspaces/model/workspace-selected-quotes";
import { useWorkspaceAiComposerDraftStore } from "#/features/workspaces/state/workspace-ai-composer-draft-store";
import { useWorkspaceUiStore } from "#/features/workspaces/state/workspace-ui-store";

type StageComposerFilesOptions = {
	onError?: (error: {
		code: "accept" | "max_file_size" | "max_files";
		message: string;
	}) => void;
	revealChat?: boolean;
};

type StageComposerQuoteOptions = {
	revealChat?: boolean;
};

export function stageComposerQuote(
	workspaceId: string,
	quote: WorkspaceSelectedQuote,
	options: StageComposerQuoteOptions = {},
) {
	const { revealChat = true } = options;

	useWorkspaceAiComposerDraftStore.getState().addQuote(workspaceId, quote);

	if (revealChat) {
		useWorkspaceUiStore.getState().openChatPanel(workspaceId);
	}
}

export function stageComposerFiles(
	workspaceId: string,
	files: File[] | FileList,
	options: StageComposerFilesOptions = {},
) {
	const { onError, revealChat = true } = options;

	useWorkspaceAiComposerDraftStore.getState().addFiles(workspaceId, files, {
		...WORKSPACE_AI_CHAT_ATTACHMENT_POLICY,
		onError,
	});

	if (revealChat) {
		useWorkspaceUiStore.getState().openChatPanel(workspaceId);
	}
}
