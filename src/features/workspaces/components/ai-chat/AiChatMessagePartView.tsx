import { isToolUIPart } from "ai";
import { LinkIcon } from "lucide-react";

import { MessageResponse } from "#/components/ai-elements/message";
import {
	AiChatAttachmentGroup,
	AiChatAttachmentItem,
	getFileAttachmentData,
	getSourceDocumentAttachmentData,
} from "#/features/workspaces/components/ai-chat/AiChatAttachmentItem";
import { AiChatToolActivityRow } from "#/features/workspaces/components/ai-chat/AiChatToolActivityRow";
import type { AiChatMessagePart } from "#/features/workspaces/components/ai-chat/types";

export function AiChatMessagePartView({ part }: { part: AiChatMessagePart }) {
	if (part.type === "text") {
		return <MessageResponse>{part.text}</MessageResponse>;
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
