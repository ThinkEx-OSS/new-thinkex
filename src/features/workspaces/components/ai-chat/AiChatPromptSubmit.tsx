import { ArrowUp, Square } from "lucide-react";

import {
	PromptInputSubmit,
	usePromptInputAttachments,
} from "#/components/ai-elements/prompt-input";
import { isAiChatStreamActive } from "#/features/workspaces/components/ai-chat/ai-chat-display-state";
import type { AiChatStatus } from "#/features/workspaces/components/ai-chat/types";
import { workspaceToolbarButtonSizeClass } from "#/features/workspaces/components/workspace-toolbar-styles";
import { cn } from "#/lib/utils";

export default function AiChatPromptSubmit({
	input,
	onStop,
	status,
}: {
	input: string;
	onStop?: () => void;
	status: AiChatStatus;
}) {
	const attachments = usePromptInputAttachments();
	const isGenerating = isAiChatStreamActive(status);
	const hasContent = Boolean(input.trim() || attachments.files.length > 0);
	const composerReady = attachments.composerReady !== false;
	const canStop = isGenerating && Boolean(onStop);

	return (
		<PromptInputSubmit
			className={cn(workspaceToolbarButtonSizeClass, "rounded-full")}
			disabled={isGenerating ? !canStop : !hasContent || !composerReady}
			status={status}
			onStop={onStop}
			type={isGenerating ? "button" : "submit"}
		>
			{isGenerating ? <Square /> : <ArrowUp />}
		</PromptInputSubmit>
	);
}
