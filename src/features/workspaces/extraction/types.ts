import type {
	WorkspaceFileAssetKind,
	WorkspaceFileExtractionRoute,
} from "#/features/workspaces/model/workspace-file/types";
import {
	workspaceFileExtractionProviders,
	type WorkspaceFileExtractionProviderId,
	type WorkspaceFileExtractionMode,
} from "#/features/workspaces/model/workspace-file/types";

export type MarkdownExtractionProviderId = WorkspaceFileExtractionProviderId;

export type MarkdownExtractionProviderMode = WorkspaceFileExtractionMode;

export type MarkdownExtractionRouteDecision = WorkspaceFileExtractionRoute;

export { workspaceFileExtractionProviders as markdownExtractionProviders };

export type FirecrawlPdfMode = "fast" | "auto" | "ocr";

export interface WorkspaceFileExtractionWorkflowParams {
	workspaceId: string;
	itemId: string;
	actorUserId: string | null;
	assetKind: WorkspaceFileAssetKind;
}

export interface MarkdownExtractionInput {
	workspaceId: string;
	itemId: string;
	bytes: Uint8Array;
	fileName: string;
	contentType: string;
	sizeBytes: number;
	sourceHash: string;
	mode: MarkdownExtractionProviderMode;
}

export interface MarkdownExtractionResult {
	markdown: string;
	provider: MarkdownExtractionProviderId;
	providerMode: MarkdownExtractionProviderMode;
	metadata: Record<string, string | number | boolean | null>;
}

export interface MarkdownExtractionProvider {
	id: MarkdownExtractionProviderId;
	extract(input: MarkdownExtractionInput): Promise<MarkdownExtractionResult>;
}
