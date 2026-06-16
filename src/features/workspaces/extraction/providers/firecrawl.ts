import { toArrayBuffer } from "#/features/workspaces/extraction/binary";
import type {
	FirecrawlPdfMode,
	PdfExtractionInput,
	PdfExtractionProvider,
	PdfExtractionResult,
} from "#/features/workspaces/extraction/types";

const defaultFirecrawlApiUrl = "https://api.firecrawl.dev";

export function createFirecrawlPdfExtractionProvider(
	env: Env,
): PdfExtractionProvider {
	return {
		id: "firecrawl",
		async extract(input) {
			const mode = normalizeFirecrawlMode(input.mode);
			const formData = new FormData();
			formData.set(
				"options",
				JSON.stringify({
					formats: ["markdown"],
					parsers: [{ type: "pdf", mode }],
				}),
			);
			formData.set(
				"file",
				new File([toArrayBuffer(input.bytes)], input.fileName, {
					type: input.contentType || "application/pdf",
				}),
			);

			const response = await fetch(`${getFirecrawlApiUrl(env)}/v2/parse`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
				},
				body: formData,
			});
			const responseJson = (await response.json().catch(() => null)) as unknown;

			if (!response.ok) {
				throw new Error(
					`Firecrawl PDF parsing failed (${response.status}): ${getFirecrawlErrorMessage(responseJson)}`,
				);
			}

			const markdown = getFirecrawlMarkdown(responseJson);

			if (!markdown) {
				throw new Error(
					"Firecrawl PDF parsing completed without markdown output.",
				);
			}

			return {
				markdown,
				provider: "firecrawl",
				providerMode: mode,
				metadata: getFirecrawlMetadata(responseJson),
			} satisfies PdfExtractionResult;
		},
	};
}

function normalizeFirecrawlMode(
	mode: PdfExtractionInput["mode"],
): FirecrawlPdfMode {
	if (mode === "fast" || mode === "ocr") {
		return mode;
	}

	return "auto";
}

function getFirecrawlApiUrl(env: Env) {
	return (env.FIRECRAWL_API_URL || defaultFirecrawlApiUrl).replace(/\/$/, "");
}

function getFirecrawlMarkdown(value: unknown): string | null {
	const candidates = [
		value,
		getRecordValue(value, "data"),
		getRecordValue(value, "document"),
		getRecordValue(value, "result"),
		getFirstArrayRecord(getRecordValue(value, "data")),
		getFirstArrayRecord(getRecordValue(value, "documents")),
		getFirstArrayRecord(getRecordValue(value, "results")),
	];

	for (const candidate of candidates) {
		const markdown = getRecordValue(candidate, "markdown");

		if (typeof markdown === "string" && markdown.trim().length > 0) {
			return markdown;
		}
	}

	return null;
}

function getFirecrawlMetadata(value: unknown) {
	const usage = getRecordValue(value, "usage");
	const metadata = getRecordValue(value, "metadata");
	const creditsUsed =
		getNumberValue(usage, "credits") ?? getNumberValue(value, "creditsUsed");
	const pageCount =
		getNumberValue(metadata, "pageCount") ?? getNumberValue(value, "pageCount");
	const result: Record<string, number> = {};

	if (creditsUsed !== null) {
		result.creditsUsed = creditsUsed;
	}

	if (pageCount !== null) {
		result.pageCount = pageCount;
	}

	return result;
}

function getFirecrawlErrorMessage(value: unknown) {
	const error = getRecordValue(value, "error");
	const message = getRecordValue(value, "message");

	if (typeof error === "string") {
		return error;
	}

	if (typeof message === "string") {
		return message;
	}

	return "unknown error";
}

function getRecordValue(value: unknown, key: string) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	return (value as Record<string, unknown>)[key] ?? null;
}

function getFirstArrayRecord(value: unknown) {
	return Array.isArray(value) ? (value[0] ?? null) : null;
}

function getNumberValue(value: unknown, key: string) {
	const field = getRecordValue(value, key);

	return typeof field === "number" ? field : null;
}
