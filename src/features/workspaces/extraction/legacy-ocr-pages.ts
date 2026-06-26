export interface LegacyOcrPage {
	index?: number;
	markdown?: string;
	footer?: string | null;
	header?: string | null;
	hyperlinks?: unknown[];
	tables?: unknown[];
}

export function parseLegacyOcrPagesProjectionContent(content: string | null) {
	if (!content?.trim()) {
		return [];
	}

	try {
		const parsed = JSON.parse(content) as unknown;

		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.filter(isLegacyOcrPage);
	} catch {
		return [];
	}
}

export function flattenLegacyOcrPagesToMarkdown(pages: readonly LegacyOcrPage[]) {
	const sections = pages.flatMap((page, pageIndex) => {
		const lines = [
			`## Page ${(typeof page.index === "number" ? page.index : pageIndex) + 1}`,
			"",
			typeof page.header === "string" && page.header.trim() ? page.header.trim() : null,
			typeof page.markdown === "string" && page.markdown.trim() ? page.markdown.trim() : null,
			typeof page.footer === "string" && page.footer.trim() ? page.footer.trim() : null,
		].filter((line): line is string => line !== null);

		return lines.length > 2 ? [lines.join("\n")] : [];
	});

	return sections.join("\n\n").trim();
}

function isLegacyOcrPage(value: unknown): value is LegacyOcrPage {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
