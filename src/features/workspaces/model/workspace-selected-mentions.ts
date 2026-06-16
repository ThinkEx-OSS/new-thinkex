export type WorkspaceSelectedMention = {
	id: string;
	label: string;
	source:
		| {
				kind: "assistant-response";
		  }
		| {
				kind: "document-selection";
				itemId: string;
		  }
		| {
				kind: "pdf-selection";
				itemId: string;
				pageNumbers: number[];
		  };
	text: string;
};

export function createWorkspaceSelectedMentionId(prefix: string) {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return `${prefix}:${crypto.randomUUID()}`;
	}

	return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

export function getPdfSelectedMentionLabel(pageNumbers: number[]) {
	if (pageNumbers.length === 0) {
		return "PDF selection";
	}

	if (pageNumbers.length === 1) {
		return `PDF p. ${pageNumbers[0]}`;
	}

	return `PDF pp. ${pageNumbers.join(", ")}`;
}

export function createAssistantResponseSelectedMention(input: {
	text: string;
}): WorkspaceSelectedMention {
	return {
		id: createWorkspaceSelectedMentionId("assistant-response"),
		label: "AI response",
		source: {
			kind: "assistant-response",
		},
		text: input.text,
	};
}

export function createDocumentSelectedMention(input: {
	itemId: string;
	text: string;
}): WorkspaceSelectedMention {
	return {
		id: createWorkspaceSelectedMentionId("document-selection"),
		label: "Document selection",
		source: {
			kind: "document-selection",
			itemId: input.itemId,
		},
		text: input.text,
	};
}

export function createPdfSelectedMention(input: {
	itemId: string;
	pageNumbers: number[];
	text: string;
}): WorkspaceSelectedMention {
	return {
		id: createWorkspaceSelectedMentionId("pdf-selection"),
		label: getPdfSelectedMentionLabel(input.pageNumbers),
		source: {
			kind: "pdf-selection",
			itemId: input.itemId,
			pageNumbers: input.pageNumbers,
		},
		text: input.text,
	};
}

export function normalizeWorkspaceSelectedMention(
	mention: unknown,
): WorkspaceSelectedMention | null {
	if (!isRecord(mention) || !isWorkspaceSelectedMentionSource(mention.source)) {
		return null;
	}

	if (
		typeof mention.id !== "string" ||
		typeof mention.label !== "string" ||
		typeof mention.text !== "string"
	) {
		return null;
	}

	const id = mention.id.trim();
	const label = mention.label.trim();
	const text = mention.text.trim();

	if (!id || !label || !text) {
		return null;
	}

	return {
		id,
		label,
		source: mention.source,
		text,
	};
}

function isWorkspaceSelectedMentionSource(
	source: unknown,
): source is WorkspaceSelectedMention["source"] {
	if (!isRecord(source) || typeof source.kind !== "string") {
		return false;
	}

	if (source.kind === "assistant-response") {
		return true;
	}

	if (source.kind === "document-selection") {
		return typeof source.itemId === "string" && Boolean(source.itemId.trim());
	}

	return (
		source.kind === "pdf-selection" &&
		typeof source.itemId === "string" &&
		Boolean(source.itemId.trim()) &&
		Array.isArray(source.pageNumbers) &&
		source.pageNumbers.every(
			(pageNumber) => Number.isInteger(pageNumber) && pageNumber > 0,
		)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
