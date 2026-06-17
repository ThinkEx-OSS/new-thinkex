import { isToolUIPart } from "ai";
import { FileText, LinkIcon } from "lucide-react";

import { MessageResponse } from "#/components/ai-elements/message";
import AiChatToolCard from "#/features/workspaces/components/ai-chat/AiChatToolCard";
import type { AiChatMessagePart } from "#/features/workspaces/components/ai-chat/types";

export function AiChatMessagePartView({ part }: { part: AiChatMessagePart }) {
	if (part.type === "text") {
		return <MessageResponse>{part.text}</MessageResponse>;
	}

	if (isToolUIPart(part)) {
		return <AiChatToolCard part={part} />;
	}

	if (part.type === "file") {
		return (
			<div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
				<FileText className="size-4" />
				<span className="min-w-0 truncate">
					{part.filename ?? part.mediaType}
				</span>
			</div>
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
		return (
			<div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
				<FileText className="size-4" />
				<span className="min-w-0 truncate">{part.filename ?? part.title}</span>
			</div>
		);
	}

	return null;
}
