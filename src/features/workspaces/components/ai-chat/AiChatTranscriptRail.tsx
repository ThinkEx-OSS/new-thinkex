import type { ComponentProps, ReactNode } from "react";

import {
	aiChatMessageRailClassName,
	aiChatMessageTopInsetClassName,
} from "#/features/workspaces/components/ai-chat/ai-chat-layout";
import { cn } from "#/lib/utils";

interface AiChatTranscriptRailProps extends ComponentProps<"div"> {
	children: ReactNode;
	withTopInset?: boolean;
}

export default function AiChatTranscriptRail({
	children,
	className,
	withTopInset = false,
	...props
}: AiChatTranscriptRailProps) {
	return (
		<div
			className={cn(
				aiChatMessageRailClassName,
				withTopInset && aiChatMessageTopInsetClassName,
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
