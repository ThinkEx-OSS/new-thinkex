import { ArrowUp, Square } from "lucide-react";

import {
	PromptInputSubmit,
	usePromptInputAttachments,
} from "#/components/ai-elements/prompt-input";
import type { AiChatStatus } from "#/features/workspaces/components/ai-chat/types";
import { cn } from "#/lib/utils";

const SEND_BUTTON_SIZE = "size-8";
const SEND_ICON_SIZE = "size-4";

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
	const isGenerating = status === "submitted" || status === "streaming";
	const hasContent = Boolean(input.trim() || attachments.files.length > 0);
	const composerReady = attachments.composerReady !== false;
	const canStop = isGenerating && Boolean(onStop);

	return (
		<PromptInputSubmit
			className={cn(SEND_BUTTON_SIZE, "rounded-full")}
			disabled={isGenerating ? !canStop : !hasContent || !composerReady}
			status={status}
			onStop={onStop}
			type={isGenerating ? "button" : "submit"}
		>
			{isGenerating ? (
				<Square className={SEND_ICON_SIZE} />
			) : (
				<ArrowUp className={SEND_ICON_SIZE} />
			)}
		</PromptInputSubmit>
	);
}
