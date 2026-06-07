import {
	isTextLikeContentType,
	readResponseText,
	responseMetadata,
} from "#/features/workspaces/ai/web-response";

const MAX_BROWSER_TEXT_BYTES = 1_000_000;
const MAX_BROWSER_ARRAY_ITEMS = 300;
const MAX_BROWSER_OBJECT_KEYS = 120;

export type BrowserQuickAction = "markdown" | "content" | "links";

export type BrowserQuickActionBinding = Fetcher & {
	quickAction(
		action: BrowserQuickAction,
		options: { url: string },
	): Promise<Response>;
};

export async function normalizeBrowserQuickActionResult(
	action: BrowserQuickAction,
	result: Response,
) {
	const contentType = result.headers.get("content-type") ?? "";
	const metadata = responseMetadata(result);

	if (contentType.includes("application/json")) {
		return normalizeBrowserActionPayload(
			action,
			extractQuickActionResult(await result.json()),
			metadata,
		);
	}

	if (isTextLikeContentType(contentType)) {
		const body = await readResponseText(result, MAX_BROWSER_TEXT_BYTES);
		return normalizeBrowserActionPayload(action, body.text, metadata, {
			truncated: body.truncated,
		});
	}

	return {
		kind: "unsupported_content_type",
		metadata,
		error:
			"Browser Run returned binary content. This chat tool reports metadata only; saving binary artifacts to the workspace should use a dedicated import tool.",
	};
}

function normalizeBrowserActionPayload(
	action: BrowserQuickAction,
	payload: unknown,
	metadata: ReturnType<typeof responseMetadata>,
	options: { truncated?: boolean } = {},
) {
	const compacted = compactBrowserPayload(payload);

	if (action === "links") {
		return {
			kind: "links",
			links: getStringArrayPayload(compacted.value),
			metadata,
			truncated: options.truncated || compacted.truncated,
		};
	}

	const text = getStringPayload(compacted.value);
	const truncated = options.truncated || compacted.truncated;

	if (action === "markdown") {
		return {
			kind: "markdown",
			markdown: text,
			metadata,
			truncated,
		};
	}

	return {
		kind: "content",
		html: text,
		metadata,
		truncated,
	};
}

function extractQuickActionResult(value: unknown) {
	if (isRecord(value) && "result" in value) {
		return value.result;
	}

	return value;
}

function getStringPayload(value: unknown) {
	if (typeof value === "string") {
		return value;
	}

	return JSON.stringify(value) ?? "";
}

function getStringArrayPayload(value: unknown) {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === "string");
	}

	return typeof value === "string" ? [value] : [];
}

function compactBrowserPayload(value: unknown) {
	const state = {
		remainingCharacters: MAX_BROWSER_TEXT_BYTES,
		truncated: false,
	};
	const compacted = compactLargeValues(value, state);

	return {
		truncated: state.truncated,
		value: compacted,
	};
}

function compactLargeValues(
	value: unknown,
	state: { remainingCharacters: number; truncated: boolean },
): unknown {
	if (typeof value === "string") {
		if (value.length <= state.remainingCharacters) {
			state.remainingCharacters -= value.length;
			return value;
		}

		state.truncated = true;
		const slice = value.slice(0, Math.max(0, state.remainingCharacters));
		state.remainingCharacters = 0;
		return `${slice}\n[truncated]`;
	}

	if (Array.isArray(value)) {
		if (value.length > MAX_BROWSER_ARRAY_ITEMS) {
			state.truncated = true;
		}

		return value
			.slice(0, MAX_BROWSER_ARRAY_ITEMS)
			.map((item) => compactLargeValues(item, state));
	}

	if (!value || typeof value !== "object") {
		return value;
	}

	const entries = Object.entries(value);

	if (entries.length > MAX_BROWSER_OBJECT_KEYS) {
		state.truncated = true;
	}

	return Object.fromEntries(
		entries
			.slice(0, MAX_BROWSER_OBJECT_KEYS)
			.map(([key, nestedValue]) => [
				key,
				compactLargeValues(nestedValue, state),
			]),
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
