import { RefreshCw } from "lucide-react";

import { Message, MessageContent } from "#/components/ai-elements/message";
import { Shimmer } from "#/components/ai-elements/shimmer";
import type { AssistantPendingKind } from "#/features/workspaces/components/ai-chat/ai-chat-display-state";

export function AiChatAssistantPending({ pending }: { pending: AssistantPendingKind }) {
	return (
		<Message from="assistant" className="max-w-full">
			<MessageContent>
				<AiChatAssistantPendingBody pending={pending} />
			</MessageContent>
		</Message>
	);
}

function AiChatAssistantPendingBody({ pending }: { pending: AssistantPendingKind }) {
	if (pending === "recovering") {
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
				<Shimmer duration={1.4}>{"Recovering response\u2026"}</Shimmer>
			</div>
		);
	}

	return <AiChatThinkingLoader />;
}

function AiChatThinkingLoader() {
	return (
		<div className="flex items-center gap-3 py-2">
			<ThinkExThinkingMark />
			<span className="text-base text-muted-foreground">Thinking...</span>
		</div>
	);
}

export function ThinkExThinkingMark({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 512 512"
			className={
				className ?? "thinkex-thinking-mark size-[18px] shrink-0 self-center text-foreground"
			}
			aria-hidden="true"
		>
			<g className="thinkex-thinking-block" style={{ animationDelay: "0ms" }}>
				<rect fill="currentColor" width="139.636" height="139.636" rx="18.5818" />
			</g>
			<g className="thinkex-thinking-block" style={{ animationDelay: "95ms" }}>
				<rect fill="currentColor" x="186.182" width="139.636" height="116.364" rx="18.5818" />
			</g>
			<g className="thinkex-thinking-block" style={{ animationDelay: "215ms" }}>
				<rect fill="currentColor" x="372.364" width="139.636" height="139.636" rx="18.5818" />
			</g>
			<g className="thinkex-thinking-block" style={{ animationDelay: "355ms" }}>
				<rect
					fill="none"
					stroke="#5C8BD6"
					strokeWidth="22"
					x="380.364"
					y="194.182"
					width="123.636"
					height="170.182"
					rx="10.5818"
				/>
			</g>
			<g className="thinkex-thinking-block" style={{ animationDelay: "520ms" }}>
				<rect
					fill="none"
					stroke="#F7B53B"
					strokeWidth="22"
					x="380.364"
					y="426.909"
					width="123.636"
					height="77.0909"
					rx="10.5818"
				/>
			</g>
			<g className="thinkex-thinking-block" style={{ animationDelay: "700ms" }}>
				<rect
					fill="currentColor"
					x="186.182"
					y="162.909"
					width="139.636"
					height="349.091"
					rx="18.5818"
				/>
			</g>
			<g className="thinkex-thinking-block" style={{ animationDelay: "905ms" }}>
				<rect
					fill="none"
					stroke="#73BF7A"
					strokeWidth="22"
					x="8"
					y="333.818"
					width="123.636"
					height="170.182"
					rx="10.5818"
				/>
			</g>
			<g className="thinkex-thinking-block" style={{ animationDelay: "1140ms" }}>
				<rect
					fill="none"
					stroke="#DA4944"
					strokeWidth="22"
					x="8"
					y="194.182"
					width="123.636"
					height="77.0909"
					rx="10.5818"
				/>
			</g>
		</svg>
	);
}
