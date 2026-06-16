import type { WorkspaceKernelFileProjectionStatus } from "#/features/workspaces/kernel/workspace-kernel-types";

export interface PdfMarkdownQualityResult {
	status: Extract<
		WorkspaceKernelFileProjectionStatus,
		"ready" | "needs_review"
	>;
	reason: string;
	markdownLength: number;
}

export function evaluatePdfMarkdownQuality(
	markdown: string,
): PdfMarkdownQualityResult {
	const markdownLength = markdown.trim().length;

	if (markdownLength < 32) {
		return {
			status: "needs_review",
			reason: "markdown_too_short",
			markdownLength,
		};
	}

	return {
		status: "ready",
		reason: "basic_markdown_present",
		markdownLength,
	};
}
