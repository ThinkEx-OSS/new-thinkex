import { isToolUIPart } from "ai";

import type {
	AiChatMessage,
	AiChatMessagePart,
	AiChatStatus,
	AiChatToolPart,
} from "#/features/workspaces/components/ai-chat/types";

export type AssistantPendingKind = "thinking" | "recovering";

export type AssistantRowDisplay =
	| { kind: "content"; parts: AiChatMessagePart[] }
	| { kind: "empty-terminal"; canRegenerate: boolean }
	| { kind: "hidden" };

export interface AiChatToolActivity {
	detail: AiChatToolPart;
	status: "completed" | "failed" | "running";
	summary: string;
	title: string;
	toolName: string;
}

export interface AiChatPresentation {
	isBusy: boolean;
	isRecovering: boolean;
	isToolContinuation: boolean;
	lastAssistantMessageId: string | undefined;
	status: AiChatStatus;
	tailPending: AssistantPendingKind | null;
}

export function isAiChatStreamActive(status: AiChatStatus) {
	return status === "submitted" || status === "streaming";
}

export function deriveAiChatPresentation(
	messages: AiChatMessage[],
	status: AiChatStatus,
	{
		isRecovering,
		isServerStreaming,
		isStreaming,
		isToolContinuation,
	}: {
		isRecovering: boolean;
		isServerStreaming: boolean;
		isStreaming: boolean;
		isToolContinuation: boolean;
	},
): AiChatPresentation {
	const lastMessage = messages.at(-1);
	const lastAssistantMessageId = lastMessage?.role === "assistant" ? lastMessage.id : undefined;
	const isBusy = isRecovering || isStreaming || isServerStreaming;
	const awaitingFirstToken = status === "submitted" && !isToolContinuation;
	const hasAssistantTail = lastMessage?.role === "assistant";
	const assistantTailIsEmpty =
		lastMessage?.role === "assistant" && getDisplayableParts(lastMessage).length === 0;
	const tailPending = isRecovering
		? hasAssistantTail && !assistantTailIsEmpty
			? null
			: "recovering"
		: !isToolContinuation &&
			  (awaitingFirstToken || (isBusy && (!hasAssistantTail || assistantTailIsEmpty)))
			? "thinking"
			: null;

	return {
		isBusy,
		isRecovering,
		isToolContinuation,
		lastAssistantMessageId,
		status,
		tailPending,
	};
}

export function getAssistantRowDisplay(
	message: AiChatMessage,
	presentation: AiChatPresentation,
): AssistantRowDisplay | null {
	if (message.role !== "assistant") {
		return null;
	}

	const displayableParts = getDisplayableParts(message);
	const isLastAssistant = message.id === presentation.lastAssistantMessageId;

	if (presentation.status === "error" && isLastAssistant && displayableParts.length === 0) {
		return { kind: "hidden" };
	}

	if (displayableParts.length > 0) {
		return { kind: "content", parts: displayableParts };
	}

	if (message.parts.some((part) => isToolUIPart(part))) {
		return { kind: "hidden" };
	}

	if (isLastAssistant && presentation.status === "ready" && !presentation.isBusy) {
		return {
			kind: "empty-terminal",
			canRegenerate: true,
		};
	}

	if (!presentation.isBusy) {
		return {
			kind: "empty-terminal",
			canRegenerate: false,
		};
	}

	return { kind: "hidden" };
}

export function getDisplayableParts(message: AiChatMessage): AiChatMessagePart[] {
	return message.parts.filter(isDisplayableMessagePart);
}

export function isDisplayableMessagePart(part: AiChatMessagePart): boolean {
	if (part.type === "text") {
		return part.text.length > 0 || part.state === "streaming";
	}

	if (part.type === "reasoning" || part.type === "step-start") {
		return false;
	}

	if (isToolUIPart(part)) {
		return isVisibleToolPart(part);
	}

	if (
		part.type === "file" ||
		part.type === "source-url" ||
		part.type === "source-document" ||
		part.type.startsWith("data-")
	) {
		return true;
	}

	return false;
}

export function getToolActivityForPart(part: AiChatToolPart): AiChatToolActivity | null {
	if (!isVisibleToolPart(part)) {
		return null;
	}

	const toolName = getToolPartName(part);
	const title = getToolActivityTitle(part, toolName);
	const status = getToolActivityStatus(part);

	return {
		detail: part,
		status,
		summary: getToolActivitySummary(part, toolName, title, status),
		title,
		toolName,
	};
}

export function isVisibleToolPart(part: AiChatToolPart) {
	const toolName = getToolPartName(part);
	return toolName !== "sandbox_bash" && !toolName.startsWith("time_");
}

function getToolPartName(part: AiChatToolPart) {
	return part.type === "dynamic-tool" ? part.toolName : part.type.split("-").slice(1).join("-");
}

function getToolActivityTitle(part: AiChatToolPart, toolName: string) {
	const title = part.title?.trim();

	if (title) {
		return title;
	}

	switch (toolName) {
		case "codemode_execute":
			return "Working";
		case "workspace_create_items":
		case "workspace_delete_items":
		case "workspace_edit_item":
		case "workspace_move_items":
		case "workspace_rename_items":
			return "Updating workspace";
		case "workspace_list_items":
		case "workspace_read_items":
			return "Reading workspace";
		case "web_search":
		case "web_markdown":
		case "web_links":
			return "Reading the web";
		case "research_discover":
		case "research_deepen":
			return "Researching sources";
		default:
			return humanizeToolName(toolName);
	}
}

function getToolActivityStatus(part: AiChatToolPart): AiChatToolActivity["status"] {
	switch (part.state) {
		case "output-available":
			return "completed";
		case "output-denied":
		case "output-error":
			return "failed";
		default:
			return "running";
	}
}

function getToolActivitySummary(
	part: AiChatToolPart,
	toolName: string,
	title: string,
	status: AiChatToolActivity["status"],
) {
	if (status === "running") {
		return title;
	}

	if (status === "failed") {
		return summarizeFailure(part, toolName);
	}

	return summarizeCompletedTool(part, toolName);
}

function summarizeFailure(part: AiChatToolPart, toolName: string) {
	const outputRecord = asRecord(part.output);
	const failedCount = getArray(outputRecord.failed).length;

	switch (toolName) {
		case "workspace_create_items":
			return failedCount > 0
				? `Couldn’t create ${formatCount(failedCount, "item")}`
				: "Couldn’t update workspace";
		case "workspace_delete_items":
			return failedCount > 0
				? `Couldn’t delete ${formatCount(failedCount, "item")}`
				: "Couldn’t update workspace";
		case "workspace_move_items":
			return failedCount > 0
				? `Couldn’t move ${formatCount(failedCount, "item")}`
				: "Couldn’t update workspace";
		case "workspace_rename_items":
			return failedCount > 0
				? `Couldn’t rename ${formatCount(failedCount, "item")}`
				: "Couldn’t update workspace";
		case "workspace_edit_item":
			return `Couldn’t update ${quoteName(getBaseName(getString(outputRecord.path) ?? getPathFromToolInput(part.input)))}`;
		default:
			return "Couldn’t complete";
	}
}

function summarizeCompletedTool(part: AiChatToolPart, toolName: string) {
	const output = part.output;

	switch (toolName) {
		case "workspace_create_items":
			return summarizeWorkspaceCreate(output);
		case "workspace_delete_items":
			return summarizeWorkspaceDelete(output);
		case "workspace_move_items":
			return summarizeWorkspaceMove(output);
		case "workspace_rename_items":
			return summarizeWorkspaceRename(output);
		case "workspace_edit_item":
			return summarizeWorkspaceEdit(output);
		case "workspace_list_items":
		case "workspace_read_items":
			return summarizeWorkspaceRead(output);
		case "web_search":
			return summarizeWebSearch(output);
		case "web_markdown":
			return "Read 1 page";
		case "web_links":
			return summarizeWebLinks(output);
		case "research_discover":
			return summarizeResearchDiscover(output);
		case "research_deepen":
			return summarizeResearchDeepen(output);
		case "codemode_execute":
			return summarizeCodemode(output);
		default:
			return summarizeUnknownResult(output);
	}
}

function summarizeWorkspaceCreate(output: unknown) {
	const items = getArray(asRecord(output).items);

	if (items.length === 1) {
		const item = asRecord(items[0]);
		const type = getString(item.type) === "folder" ? "folder" : "document";
		return `Created ${type} ${quoteName(getBaseName(getString(item.path)))}`;
	}

	if (items.length === 2) {
		return `Created ${joinNames(items, "item")}`;
	}

	return `Created ${formatCount(items.length, "item")}`;
}

function summarizeWorkspaceDelete(output: unknown) {
	const items = getArray(asRecord(output).items);

	if (items.length === 1) {
		return `Deleted ${quoteName(getBaseName(getString(asRecord(items[0]).path)))}`;
	}

	if (items.length === 2) {
		return `Deleted ${joinNames(items, "item")}`;
	}

	return `Deleted ${formatCount(items.length, "item")}`;
}

function summarizeWorkspaceMove(output: unknown) {
	const items = getArray(asRecord(output).items);

	if (items.length === 1) {
		return `Moved ${quoteName(getBaseName(getString(asRecord(items[0]).path)))}`;
	}

	if (items.length === 2) {
		return `Moved ${joinNames(items, "item")}`;
	}

	return `Moved ${formatCount(items.length, "item")}`;
}

function summarizeWorkspaceRename(output: unknown) {
	const items = getArray(asRecord(output).items);

	if (items.length === 1) {
		return `Renamed ${quoteName(getBaseName(getString(asRecord(items[0]).path)))}`;
	}

	if (items.length === 2) {
		return `Renamed ${joinNames(items, "item")}`;
	}

	return `Renamed ${formatCount(items.length, "item")}`;
}

function summarizeWorkspaceEdit(output: unknown) {
	const record = asRecord(output);
	return `Updated ${quoteName(getBaseName(getString(record.path)))}`;
}

function summarizeWorkspaceRead(output: unknown) {
	const items = getArray(asRecord(output).items);
	const readyItems = items.filter((item) => getString(asRecord(item).status) !== "failed");

	if (readyItems.length === 1) {
		return `Read ${quoteName(getBaseName(getString(asRecord(readyItems[0]).path)))}`;
	}

	return `Read ${formatCount(readyItems.length, "item")}`;
}

function summarizeWebSearch(output: unknown) {
	const results = getArray(asRecord(output).results);
	return `Found ${formatCount(results.length, "source")}`;
}

function summarizeWebLinks(output: unknown) {
	const items = getArray(asRecord(output).items);
	return `Found ${formatCount(items.length, "link")}`;
}

function summarizeResearchDiscover(output: unknown) {
	const record = asRecord(output);
	const total = getArray(record.papers).length + getArray(record.github).length;
	return `Found ${formatCount(total, "source")}`;
}

function summarizeResearchDeepen(output: unknown) {
	const record = asRecord(output);

	if (Array.isArray(record.passages)) {
		return `Read ${formatCount(record.passages.length, "passage")}`;
	}

	if (Array.isArray(record.papers)) {
		return `Found ${formatCount(record.papers.length, "paper")}`;
	}

	return summarizeUnknownResult(output);
}

function summarizeCodemode(output: unknown) {
	const record = asRecord(output);
	const status = getString(record.status);

	if (status === "paused") {
		return "Needs input";
	}

	if (status === "error") {
		return "Couldn’t complete";
	}

	if (status === "completed") {
		return summarizeUnknownResult(record.result);
	}

	return summarizeUnknownResult(output);
}

function summarizeUnknownResult(output: unknown) {
	const record = asRecord(output);

	if (Array.isArray(record.items)) {
		return `Processed ${formatCount(record.items.length, "item")}`;
	}

	if (Array.isArray(record.results)) {
		return `Found ${formatCount(record.results.length, "result")}`;
	}

	if (Array.isArray(record.papers)) {
		return `Found ${formatCount(record.papers.length, "paper")}`;
	}

	if (Array.isArray(record.passages)) {
		return `Read ${formatCount(record.passages.length, "passage")}`;
	}

	if (typeof record.content === "string") {
		return "Read 1 page";
	}

	return "Done";
}

function humanizeToolName(value: string) {
	return value
		.split("_")
		.filter(Boolean)
		.map((segment, index) =>
			index === 0 ? segment.charAt(0).toUpperCase() + segment.slice(1) : segment,
		)
		.join(" ");
}

function quoteName(value: string | undefined) {
	return value ? `“${value}”` : "item";
}

function joinNames(items: unknown[], fallbackNoun: string) {
	const names = items
		.slice(0, 2)
		.map((item) => quoteName(getBaseName(getString(asRecord(item).path))))
		.filter((name) => name !== "item");

	if (names.length === 2) {
		return `${names[0]} and ${names[1]}`;
	}

	if (names.length === 1) {
		return names[0];
	}

	return formatCount(items.length, fallbackNoun);
}

function formatCount(count: number, noun: string) {
	const safeCount = Number.isFinite(count) && count > 0 ? count : 0;
	return `${safeCount} ${noun}${safeCount === 1 ? "" : "s"}`;
}

function getBaseName(path: string | undefined) {
	if (!path) {
		return undefined;
	}

	const segments = path.split("/").filter(Boolean);
	return segments.at(-1) ?? path;
}

function getPathFromToolInput(input: unknown) {
	return getString(asRecord(input).path);
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function getString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}
