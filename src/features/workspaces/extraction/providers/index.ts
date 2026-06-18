import { createFirecrawlPdfExtractionProvider } from "#/features/workspaces/extraction/providers/firecrawl";
import { createStubMarkdownExtractionProvider } from "#/features/workspaces/extraction/providers/stubs";
import { createWorkersAiToMarkdownProvider } from "#/features/workspaces/extraction/providers/workers-ai-to-markdown";
import type {
	MarkdownExtractionProvider,
	MarkdownExtractionProviderId,
} from "#/features/workspaces/extraction/types";

export function createMarkdownExtractionProvider(
	providerId: MarkdownExtractionProviderId,
	env: Env,
): MarkdownExtractionProvider {
	switch (providerId) {
		case "firecrawl":
			return createFirecrawlPdfExtractionProvider(env);
		case "workers_ai_to_markdown":
			return createWorkersAiToMarkdownProvider(env);
		case "mistral_ocr":
		case "llama_parse":
			return createStubMarkdownExtractionProvider(providerId);
	}
}
