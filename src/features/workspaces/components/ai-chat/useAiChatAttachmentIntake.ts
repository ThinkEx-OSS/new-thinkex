import { useCallback, useState } from "react";
import { toast } from "sonner";

import { WORKSPACE_AI_CHAT_ATTACHMENT_POLICY } from "#/features/workspaces/components/ai-chat/constants";
import {
	classifyIncomingChatFiles,
	type ReviewedIncomingFile,
} from "#/features/workspaces/files/file-intake-review";
import { resolveWorkspaceUploadDestination } from "#/features/workspaces/model/view";
import type { WorkspaceItem } from "#/features/workspaces/model/types";

interface UseAiChatAttachmentIntakeInput {
	activeItem?: WorkspaceItem;
	addDraftFiles: (
		files: File[] | FileList,
		options?: {
			accept?: string;
			maxFileSize?: number;
			maxFiles?: number;
			onError?: (error: { message: string }) => void;
		},
	) => void;
	canUploadToWorkspace: boolean;
	currentChatFileCount: number;
	itemsById: ReadonlyMap<string, WorkspaceItem>;
	uploadWorkspaceFiles: (files: Iterable<File>, parentId: string | null) => void;
	workspaceName: string;
}

interface ChatAttachmentReviewState {
	destinationLabel: string;
	destinationParentId: string | null;
	rejectedFiles: ReviewedIncomingFile[];
	workspaceFallbackFiles: ReviewedIncomingFile[];
}

export function useAiChatAttachmentIntake({
	activeItem,
	addDraftFiles,
	canUploadToWorkspace,
	currentChatFileCount,
	itemsById,
	uploadWorkspaceFiles,
	workspaceName,
}: UseAiChatAttachmentIntakeInput) {
	const [reviewState, setReviewState] = useState<ChatAttachmentReviewState | null>(null);

	const addFiles = useCallback(
		(files: File[] | FileList) => {
			const review = classifyIncomingChatFiles(Array.from(files), {
				canUploadToWorkspace,
				currentChatFileCount,
			});

			if (review.chatAccepted.length > 0) {
				addDraftFiles(review.chatAccepted, {
					...WORKSPACE_AI_CHAT_ATTACHMENT_POLICY,
					onError: (error) => toast.error(error.message),
				});
			}

			if (review.workspaceFallback.length > 0 || review.rejected.length > 0) {
				const destinationParentId = resolveWorkspaceUploadDestination(activeItem);
				const destinationLabel = getWorkspaceUploadDestinationLabel({
					activeItem,
					destinationParentId,
					itemsById,
					workspaceName,
				});

				setReviewState((prev) => ({
					destinationLabel,
					destinationParentId,
					rejectedFiles: [...(prev?.rejectedFiles ?? []), ...review.rejected],
					workspaceFallbackFiles: [
						...(prev?.workspaceFallbackFiles ?? []),
						...review.workspaceFallback,
					],
				}));
			}
		},
		[
			activeItem,
			addDraftFiles,
			canUploadToWorkspace,
			currentChatFileCount,
			itemsById,
			workspaceName,
		],
	);

	const confirmWorkspaceFallback = useCallback(() => {
		if (!reviewState) {
			return;
		}

		if (reviewState.workspaceFallbackFiles.length > 0) {
			uploadWorkspaceFiles(
				reviewState.workspaceFallbackFiles.map((item) => item.file),
				reviewState.destinationParentId,
			);
		}

		setReviewState(null);
	}, [reviewState, uploadWorkspaceFiles]);

	return {
		addFiles,
		closeReview: () => setReviewState(null),
		confirmWorkspaceFallback,
		reviewState,
	};
}

function getWorkspaceUploadDestinationLabel({
	activeItem,
	destinationParentId,
	itemsById,
	workspaceName,
}: {
	activeItem?: WorkspaceItem;
	destinationParentId: string | null;
	itemsById: ReadonlyMap<string, WorkspaceItem>;
	workspaceName: string;
}) {
	if (!activeItem || destinationParentId === null) {
		return `${workspaceName} root`;
	}

	if (activeItem.type === "folder") {
		return activeItem.name;
	}

	return itemsById.get(destinationParentId)?.name ?? workspaceName;
}
