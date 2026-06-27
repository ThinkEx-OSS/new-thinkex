import {
	parseMarkdownPageProjection,
	serializeMarkdownPageProjection,
} from "#/features/workspaces/extraction/markdown-page-projection";

export interface WorkspaceKernelAiPdfPages {
	requested: string;
	returned: number[];
	total: number;
}

export class WorkspaceKernelAiPdfPageError extends Error {
	constructor(readonly code: "page_range_out_of_range") {
		super(code);
	}
}

export function readWorkspaceAiPdfPages(
	content: string,
	input: {
		pages?: string;
	},
): { content: string; pdfPages: WorkspaceKernelAiPdfPages } {
	const pdfPages = parseMarkdownPageProjection(content);
	const maxPageNumber = pdfPages.reduce((max, page) => Math.max(max, page.pageNumber), 0);
	const requested = input.pages?.trim() || "1";
	const selectedPageNumbers = parseWorkspaceAiPdfPageRange(requested, maxPageNumber);
	const selectedPages = selectedPageNumbers.map((pageNumber) => {
		const page = pdfPages.find((candidate) => candidate.pageNumber === pageNumber);

		if (!page) {
			throw new WorkspaceKernelAiPdfPageError("page_range_out_of_range");
		}

		return page;
	});

	return {
		content: serializeMarkdownPageProjection(selectedPages),
		pdfPages: {
			requested,
			returned: selectedPages.map((page) => page.pageNumber),
			total: maxPageNumber,
		},
	};
}

function parseWorkspaceAiPdfPageRange(value: string, totalPages: number) {
	const selected = new Set<number>();
	const parts = value.split(",");

	for (const rawPart of parts) {
		const part = rawPart.trim();

		if (!part) {
			continue;
		}

		const rangeMatch = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);

		if (!rangeMatch) {
			throw new WorkspaceKernelAiPdfPageError("page_range_out_of_range");
		}

		const start = Number(rangeMatch[1]);
		const end = Number(rangeMatch[2] ?? rangeMatch[1]);

		if (start < 1 || end < start || end > totalPages) {
			throw new WorkspaceKernelAiPdfPageError("page_range_out_of_range");
		}

		for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
			selected.add(pageNumber);
		}
	}

	if (selected.size === 0) {
		throw new WorkspaceKernelAiPdfPageError("page_range_out_of_range");
	}

	return Array.from(selected).sort((left, right) => left - right);
}
