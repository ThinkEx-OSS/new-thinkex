import { FileText, X } from "lucide-react";

import { usePromptInputAttachments } from "#/components/ai-elements/prompt-input";

export default function AiChatPromptAttachments() {
	const attachments = usePromptInputAttachments();

	if (attachments.files.length === 0) {
		return null;
	}

	return (
		<div className="flex min-w-0 flex-wrap gap-1.5 px-2 pt-2">
			{attachments.files.map((file) => (
				<div
					key={file.id}
					className="flex h-8 min-w-0 max-w-44 items-center gap-1.5 rounded-md border bg-background/70 px-2 text-muted-foreground text-xs"
				>
					<FileText className="size-3.5 shrink-0" />
					<span className="min-w-0 truncate">
						{file.filename ?? file.mediaType}
					</span>
					<button
						type="button"
						className="ml-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-muted hover:text-foreground"
						aria-label="Remove attachment"
						onClick={() => attachments.remove(file.id)}
					>
						<X className="size-3" />
					</button>
				</div>
			))}
		</div>
	);
}
