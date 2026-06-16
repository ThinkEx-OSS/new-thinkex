import { createFirecrawlPdfExtractionProvider } from "#/features/workspaces/extraction/providers/firecrawl";
import { createStubPdfExtractionProvider } from "#/features/workspaces/extraction/providers/stubs";
import type {
	PdfExtractionProvider,
	PdfExtractionProviderId,
	PdfExtractionRouteDecision,
} from "#/features/workspaces/extraction/types";

export function routePdfExtraction(): PdfExtractionRouteDecision {
	// V1 routes every PDF through Firecrawl's auto mode: native text extraction
	// first, OCR fallback when the PDF is scanned or image-heavy.
	//
	// Future routing inputs should include org policy, file size/page count,
	// privacy tier, language hints, cost ceiling, and retry history. Keep those
	// decisions here so upload, workflow, and kernel storage stay provider-neutral.
	return {
		provider: "firecrawl",
		mode: "auto",
		reason: "default_pdf_upload_route",
	};
}

export function createPdfExtractionProvider(
	providerId: PdfExtractionProviderId,
	env: Env,
): PdfExtractionProvider {
	switch (providerId) {
		case "firecrawl":
			return createFirecrawlPdfExtractionProvider(env);
		case "workers_ai_to_markdown":
		case "mistral_ocr":
		case "llama_parse":
			return createStubPdfExtractionProvider(providerId);
	}
}
