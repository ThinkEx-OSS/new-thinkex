import type { MarkdownProjectionPage } from "#/features/workspaces/extraction/page-markdown-projection.ts";

export interface LegacyOcrPage {
	index: number;
	markdown: string;
	header?: string;
	footer?: string;
	tables?: unknown;
	hyperlinks?: unknown;
}

export function convertLegacyOcrPages(
	legacyPages: readonly LegacyOcrPage[],
): MarkdownProjectionPage[] {
	return legacyPages
		.map((page): MarkdownProjectionPage | null => {
			const markdown = typeof page.markdown === "string" ? page.markdown.trim() : "";

			if (!markdown) {
				return null;
			}

			const pageNumber =
				typeof page.index === "number" && Number.isInteger(page.index) && page.index >= 0
					? page.index + 1
					: null;

			if (!pageNumber) {
				return null;
			}

			return { pageNumber, markdown };
		})
		.filter((page): page is MarkdownProjectionPage => page !== null);
}
