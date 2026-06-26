import { isToolUIPart } from "ai";
import { LinkIcon } from "lucide-react";

import { MessageResponse } from "#/components/ai-elements/message";
import {
	AiChatAttachmentGroup,
	AiChatAttachmentItem,
	getFileAttachmentData,
	getSourceDocumentAttachmentData,
} from "#/features/workspaces/components/ai-chat/AiChatAttachmentItem";
import type { AiChatToolGroupPart } from "#/features/workspaces/components/ai-chat/ai-chat-display-state";
import { AiChatToolActivityRow } from "#/features/workspaces/components/ai-chat/AiChatToolActivityRow";
import type { AiChatMessagePart } from "#/features/workspaces/components/ai-chat/types";

export function AiChatMessagePartView({ part }: { part: AiChatMessagePart | AiChatToolGroupPart }) {
	if (part.type === "text") {
		return <MessageResponse>{part.text}</MessageResponse>;
	}

	if (isAiChatToolGroupPart(part)) {
		return <AiChatToolActivityRow part={part.part} nestedChildren={part.children} />;
	}

	if (isToolUIPart(part)) {
		return <AiChatToolActivityRow part={part} />;
	}

	if (part.type === "file") {
		const attachment = getFileAttachmentData(part);

		return (
			<AiChatAttachmentGroup data={attachment}>
				<AiChatAttachmentItem data={attachment} />
			</AiChatAttachmentGroup>
		);
	}

	if (part.type === "source-url") {
		return (
			<a
				className="inline-flex max-w-full items-center gap-2 text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
				href={part.url}
				rel="noreferrer"
				target="_blank"
			>
				<LinkIcon className="size-4 shrink-0" />
				<span className="truncate">{part.title ?? part.url}</span>
			</a>
		);
	}

	if (part.type === "source-document") {
		const attachment = getSourceDocumentAttachmentData(part);

		return (
			<AiChatAttachmentGroup data={attachment}>
				<AiChatAttachmentItem data={attachment} />
			</AiChatAttachmentGroup>
		);
	}

	return null;
}

function isAiChatToolGroupPart(
	part: AiChatMessagePart | AiChatToolGroupPart,
): part is AiChatToolGroupPart {
	return part.type === "data-tool-group" && "part" in part && "children" in part;
}
