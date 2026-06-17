import { RefreshCw } from "lucide-react";

import { Message, MessageContent } from "#/components/ai-elements/message";
import { Shimmer } from "#/components/ai-elements/shimmer";
import type { AssistantPendingKind } from "#/features/workspaces/components/ai-chat/ai-chat-display-state";

export function AiChatAssistantPending({
	pending,
}: {
	pending: AssistantPendingKind;
}) {
	if (pending === "recovering") {
		return (
			<Message from="assistant" className="max-w-full">
				<MessageContent>
					<div className="flex items-center gap-2 text-muted-foreground">
						<RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
						<Shimmer duration={1.4}>{"Recovering response\u2026"}</Shimmer>
					</div>
				</MessageContent>
			</Message>
		);
	}

	return (
		<Message from="assistant" className="max-w-full">
			<MessageContent>
				<Shimmer duration={1}>{"Thinking\u2026"}</Shimmer>
			</MessageContent>
		</Message>
	);
}
