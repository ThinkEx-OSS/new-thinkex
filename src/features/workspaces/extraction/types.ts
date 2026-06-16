export const pdfExtractionProviders = [
	"firecrawl",
	"workers_ai_to_markdown",
	"mistral_ocr",
	"llama_parse",
] as const;

export type PdfExtractionProviderId = (typeof pdfExtractionProviders)[number];

export type FirecrawlPdfMode = "fast" | "auto" | "ocr";

export type PdfExtractionProviderMode = FirecrawlPdfMode | "stub";

export interface WorkspaceFileExtractionWorkflowParams {
	workspaceId: string;
	itemId: string;
	actorUserId: string | null;
}

export interface PdfExtractionInput {
	workspaceId: string;
	itemId: string;
	bytes: Uint8Array;
	fileName: string;
	contentType: string;
	sizeBytes: number;
	sourceHash: string;
	mode: PdfExtractionProviderMode;
}

export interface PdfExtractionResult {
	markdown: string;
	provider: PdfExtractionProviderId;
	providerMode: PdfExtractionProviderMode;
	metadata: Record<string, string | number | boolean | null>;
}

export interface PdfExtractionProvider {
	id: PdfExtractionProviderId;
	extract(input: PdfExtractionInput): Promise<PdfExtractionResult>;
}

export interface PdfExtractionRouteDecision {
	provider: PdfExtractionProviderId;
	mode: PdfExtractionProviderMode;
	reason: string;
}
