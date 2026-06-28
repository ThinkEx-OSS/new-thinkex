import type { JsonValue } from "#/features/workspaces/contracts";
import { stringifyTiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document.ts";
import { parseMarkdownToTiptapDocumentProjection } from "#/features/workspaces/documents/document-markdown.ts";

export interface LegacyDocumentContent {
	textContent?: string | null;
	structuredData?: {
		markdown?: string;
		[key: string]: unknown;
	} | null;
	sourceData?: JsonValue | null;
}

export interface ConvertedDocument {
	content: string;
	metadataJson: Record<string, JsonValue>;
}

export function convertLegacyDocument(legacy: LegacyDocumentContent): ConvertedDocument {
	const markdown = resolveDocumentMarkdown(legacy);
	const projection = parseMarkdownToTiptapDocumentProjection(markdown);
	const content = stringifyTiptapDocumentJson(projection.document);

	const metadataJson: Record<string, JsonValue> = {};

	if (legacy.sourceData !== undefined && legacy.sourceData !== null) {
		metadataJson.sources = legacy.sourceData;
	}

	return { content, metadataJson };
}

function resolveDocumentMarkdown(legacy: LegacyDocumentContent): string {
	if (legacy.structuredData?.markdown) {
		return legacy.structuredData.markdown;
	}

	if (legacy.textContent) {
		return legacy.textContent;
	}

	return "";
}
