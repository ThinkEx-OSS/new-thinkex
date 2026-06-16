import type {
	PdfExtractionProvider,
	PdfExtractionProviderId,
} from "#/features/workspaces/extraction/types";

export function createStubPdfExtractionProvider(
	id: Exclude<PdfExtractionProviderId, "firecrawl">,
): PdfExtractionProvider {
	return {
		id,
		async extract() {
			throw new Error(
				`${id} PDF extraction is intentionally stubbed. Add credentials, pricing limits, and quality gates before routing uploads here.`,
			);
		},
	};
}
