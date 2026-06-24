import { z } from "zod";

import { type JsonValue, jsonValueSchema } from "#/features/workspaces/contracts";

export interface TiptapDocumentJson {
	type: "doc";
	content?: JsonValue[];
	[key: string]: JsonValue | undefined;
}

export const tiptapDocumentJsonSchema = z
	.looseObject({
		type: z.literal("doc"),
		content: z.array(jsonValueSchema).optional(),
	})
	.transform((value) => normalizeTiptapDocumentJson(value));

export function createInitialTiptapDocumentJson(name: string): TiptapDocumentJson {
	const title = name.trim();

	return {
		type: "doc",
		content: title
			? [
					{
						type: "heading",
						attrs: { level: 1 },
						content: [{ type: "text", text: title }],
					},
					{ type: "paragraph" },
				]
			: [{ type: "paragraph" }],
	};
}

export function parseTiptapDocumentJson(content: string | null): TiptapDocumentJson {
	if (!content?.trim()) {
		throw new Error("Workspace document content is missing.");
	}

	return normalizeTiptapDocumentJson(JSON.parse(content));
}

export function stringifyTiptapDocumentJson(document: TiptapDocumentJson) {
	return `${JSON.stringify(normalizeTiptapDocumentJson(document))}\n`;
}

function normalizeTiptapDocumentJson(value: unknown, _context?: unknown): TiptapDocumentJson {
	if (!isRecord(value) || value.type !== "doc") {
		throw new Error("Workspace document content is not Tiptap JSON.");
	}

	const content = Array.isArray(value.content) ? value.content.filter(isJsonValue) : undefined;

	return {
		...(value as Record<string, JsonValue>),
		type: "doc",
		content: content && content.length > 0 ? content : [{ type: "paragraph" }],
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return true;
	}

	if (Array.isArray(value)) {
		return value.every(isJsonValue);
	}

	if (isRecord(value)) {
		return Object.values(value).every(isJsonValue);
	}

	return false;
}
