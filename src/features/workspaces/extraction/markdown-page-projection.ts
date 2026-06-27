export interface MarkdownProjectionPage {
	pageNumber: number;
	markdown: string;
}

const markdownPageMarkerPattern = /^<!--\s*(?:thinkex:pdf-page|page)\s+(\d+)\s*-->\s*$/gm;

export function serializeMarkdownPageProjection(pages: MarkdownProjectionPage[]) {
	return pages
		.map((page) => `<!-- thinkex:pdf-page ${page.pageNumber} -->\n\n${page.markdown}`)
		.join("\n\n");
}

export function parseMarkdownPageProjection(content: string) {
	const matches = Array.from(content.matchAll(markdownPageMarkerPattern));

	if (matches.length === 0) {
		return [{ pageNumber: 1, markdown: content }];
	}

	return matches.map((match, index) => {
		const markerStart = match.index ?? 0;
		const markdownStart = markerStart + match[0].length;
		const markdownEnd = matches[index + 1]?.index ?? content.length;

		return {
			pageNumber: Number(match[1]),
			markdown: content.slice(markdownStart, markdownEnd).replace(/^\n+|\n+$/g, ""),
		};
	});
}
