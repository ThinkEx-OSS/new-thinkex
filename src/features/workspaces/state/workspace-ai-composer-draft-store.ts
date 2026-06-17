import type { FileUIPart } from "ai";
import { nanoid } from "nanoid";
import { useMemo } from "react";
import { create } from "zustand";

import {
	normalizeWorkspaceSelectedQuote,
	type WorkspaceSelectedQuote,
} from "#/features/workspaces/model/workspace-selected-quotes";
import { acceptIncomingFiles } from "#/lib/accept-files";

export type WorkspaceAiComposerDraftFile = FileUIPart & { id: string };

type AddWorkspaceAiComposerDraftFilesOptions = {
	accept?: string;
	maxFileSize?: number;
	maxFiles?: number;
	onError?: (error: WorkspaceAiComposerDraftFileError) => void;
};

type WorkspaceAiComposerDraftFileError = {
	code: "accept" | "max_file_size" | "max_files";
	message: string;
};

interface WorkspaceAiComposerDraftState {
	filesByWorkspaceId: Record<
		string,
		WorkspaceAiComposerDraftFile[] | undefined
	>;
	quotesByWorkspaceId: Record<string, WorkspaceSelectedQuote[] | undefined>;
	addFiles: (
		workspaceId: string,
		files: File[] | FileList,
		options?: AddWorkspaceAiComposerDraftFilesOptions,
	) => void;
	addQuote: (workspaceId: string, quote: WorkspaceSelectedQuote) => void;
	clearDraftArtifacts: (workspaceId: string) => void;
	clearFiles: (workspaceId: string) => void;
	clearQuotes: (workspaceId: string) => void;
	removeFile: (workspaceId: string, fileId: string) => void;
	removeQuote: (workspaceId: string, quoteId: string) => void;
}

const EMPTY_DRAFT_FILES: WorkspaceAiComposerDraftFile[] = [];
const EMPTY_DRAFT_QUOTES: WorkspaceSelectedQuote[] = [];

export const useWorkspaceAiComposerDraftStore =
	create<WorkspaceAiComposerDraftState>()((set) => ({
		addFiles: (workspaceId, fileList, options) => {
			set((state) => {
				const current =
					state.filesByWorkspaceId[workspaceId] ?? EMPTY_DRAFT_FILES;
				const capped = acceptIncomingFiles([...fileList], {
					accept: options?.accept,
					currentCount: current.length,
					maxFileSize: options?.maxFileSize,
					maxFiles: options?.maxFiles,
					onError: options?.onError,
				});

				if (capped.length === 0) {
					return state;
				}

				return {
					filesByWorkspaceId: {
						...state.filesByWorkspaceId,
						[workspaceId]: [...current, ...capped.map(createDraftFile)],
					},
				};
			});
		},
		addQuote: (workspaceId, quote) =>
			set((state) => {
				const normalizedQuote = normalizeWorkspaceSelectedQuote(quote);
				if (!normalizedQuote) {
					return state;
				}

				const current =
					state.quotesByWorkspaceId[workspaceId] ?? EMPTY_DRAFT_QUOTES;

				return {
					quotesByWorkspaceId: {
						...state.quotesByWorkspaceId,
						[workspaceId]: [
							...current.filter((item) => item.id !== normalizedQuote.id),
							normalizedQuote,
						],
					},
				};
			}),
		clearDraftArtifacts: (workspaceId) =>
			set((state) => clearDraftArtifactsForWorkspace(state, workspaceId)),
		clearFiles: (workspaceId) =>
			set((state) => clearFilesForWorkspace(state, workspaceId)),
		clearQuotes: (workspaceId) =>
			set((state) => {
				const current =
					state.quotesByWorkspaceId[workspaceId] ?? EMPTY_DRAFT_QUOTES;
				if (current.length === 0) {
					return state;
				}

				return {
					quotesByWorkspaceId: {
						...state.quotesByWorkspaceId,
						[workspaceId]: undefined,
					},
				};
			}),
		filesByWorkspaceId: {},
		quotesByWorkspaceId: {},
		removeFile: (workspaceId, fileId) =>
			set((state) => {
				const current =
					state.filesByWorkspaceId[workspaceId] ?? EMPTY_DRAFT_FILES;
				const removed = current.find((file) => file.id === fileId);
				if (!removed) {
					return state;
				}

				revokeDraftFileUrl(removed);

				const next = current.filter((file) => file.id !== fileId);
				return {
					filesByWorkspaceId: {
						...state.filesByWorkspaceId,
						[workspaceId]: next.length > 0 ? next : undefined,
					},
				};
			}),
		removeQuote: (workspaceId, quoteId) =>
			set((state) => {
				const current =
					state.quotesByWorkspaceId[workspaceId] ?? EMPTY_DRAFT_QUOTES;
				if (!current.some((quote) => quote.id === quoteId)) {
					return state;
				}

				const next = current.filter((quote) => quote.id !== quoteId);
				return {
					quotesByWorkspaceId: {
						...state.quotesByWorkspaceId,
						[workspaceId]: next.length > 0 ? next : undefined,
					},
				};
			}),
	}));

export function useWorkspaceAiComposerDraftFiles(workspaceId: string) {
	return useWorkspaceAiComposerDraftStore(
		useMemo(
			() => (state: WorkspaceAiComposerDraftState) =>
				state.filesByWorkspaceId[workspaceId] ?? EMPTY_DRAFT_FILES,
			[workspaceId],
		),
	);
}

export function useWorkspaceAiComposerDraftQuotes(workspaceId: string) {
	return useWorkspaceAiComposerDraftStore(
		useMemo(
			() => (state: WorkspaceAiComposerDraftState) =>
				state.quotesByWorkspaceId[workspaceId] ?? EMPTY_DRAFT_QUOTES,
			[workspaceId],
		),
	);
}

function clearDraftArtifactsForWorkspace(
	state: WorkspaceAiComposerDraftState,
	workspaceId: string,
) {
	return clearQuotesForWorkspace(
		clearFilesForWorkspace(state, workspaceId),
		workspaceId,
	);
}

function clearFilesForWorkspace(
	state: WorkspaceAiComposerDraftState,
	workspaceId: string,
) {
	const current = state.filesByWorkspaceId[workspaceId] ?? EMPTY_DRAFT_FILES;
	if (current.length === 0) {
		return state;
	}

	for (const file of current) {
		revokeDraftFileUrl(file);
	}

	return {
		...state,
		filesByWorkspaceId: {
			...state.filesByWorkspaceId,
			[workspaceId]: undefined,
		},
	};
}

function clearQuotesForWorkspace(
	state: WorkspaceAiComposerDraftState,
	workspaceId: string,
) {
	const current = state.quotesByWorkspaceId[workspaceId] ?? EMPTY_DRAFT_QUOTES;
	if (current.length === 0) {
		return state;
	}

	return {
		...state,
		quotesByWorkspaceId: {
			...state.quotesByWorkspaceId,
			[workspaceId]: undefined,
		},
	};
}

function createDraftFile(file: File): WorkspaceAiComposerDraftFile {
	return {
		filename: file.name,
		id: nanoid(),
		mediaType: file.type,
		type: "file",
		url: URL.createObjectURL(file),
	};
}

function revokeDraftFileUrl(file: WorkspaceAiComposerDraftFile) {
	if (file.url?.startsWith("blob:")) {
		URL.revokeObjectURL(file.url);
	}
}
