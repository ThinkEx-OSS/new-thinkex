import { Plus } from "lucide-react";
import { useRef, useState } from "react";

import {
	PromptInput,
	PromptInputActionAddAttachments,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuTrigger,
	PromptInputBody,
	PromptInputFooter,
	PromptInputHeader,
	type PromptInputMessage,
	PromptInputSelect,
	PromptInputSelectContent,
	PromptInputSelectGroup,
	PromptInputSelectItem,
	PromptInputSelectTrigger,
	PromptInputSelectValue,
	PromptInputTextarea,
	PromptInputTools,
} from "#/components/ai-elements/prompt-input";
import { buttonVariants } from "#/components/ui/button";
import AiChatPromptAttachments from "#/features/workspaces/components/ai-chat/AiChatPromptAttachments";
import AiChatPromptSubmit from "#/features/workspaces/components/ai-chat/AiChatPromptSubmit";
import {
	AI_CHAT_MODELS,
	DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
} from "#/features/workspaces/components/ai-chat/constants";
import type {
	AiChatModelId,
	AiChatStatus,
} from "#/features/workspaces/components/ai-chat/types";
import { useTypeToFocusPrompt } from "#/features/workspaces/components/ai-chat/useTypeToFocusPrompt";
import { cn } from "#/lib/utils";

// InputGroup defaults to a single horizontal row. Stack vertically so the
// footer toolbar stays visible below the textarea instead of being clipped.
const PROMPT_INPUT_GROUP_CLASSNAME =
	"h-auto flex-col border-border/70 bg-muted/30 shadow-none dark:bg-muted/30";
const PROMPT_INPUT_PADDING_X = "px-3.5";
const PROMPT_INPUT_FOOTER_PADDING_X = "pl-2 pr-3.5";
const TOOLBAR_CONTROL_SIZE = "size-9";
const TOOLBAR_CONTROL_HEIGHT = "h-9";
const TOOLBAR_ICON_SIZE = "size-5";
const TOOLBAR_MUTED_TEXT = "text-muted-foreground";

interface AiChatPromptInputProps {
	modelId?: AiChatModelId;
	onModelChange?: (modelId: AiChatModelId) => void;
	onSubmit?: (message: PromptInputMessage) => boolean | Promise<boolean>;
	onStop?: () => void;
	status?: AiChatStatus;
}

export default function AiChatPromptInput({
	modelId = DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
	onModelChange,
	onSubmit,
	onStop,
	status = "ready",
}: AiChatPromptInputProps) {
	const [input, setInput] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useTypeToFocusPrompt({
		enabled: status === "ready",
		setInput,
		textareaRef,
	});

	const handleSubmit = async (message: PromptInputMessage) => {
		if (
			status !== "ready" ||
			(!message.text.trim() && message.files.length === 0)
		) {
			return false;
		}

		const accepted = onSubmit ? await onSubmit(message) : false;
		if (!accepted) {
			return false;
		}

		setInput("");
		return true;
	};

	const handleModelChange = (value: string) => {
		onModelChange?.(value as AiChatModelId);
	};

	return (
		<PromptInput
			inputGroupClassName={PROMPT_INPUT_GROUP_CLASSNAME}
			onSubmit={handleSubmit}
			multiple
		>
			<PromptInputHeader>
				<AiChatPromptAttachments />
			</PromptInputHeader>
			<PromptInputBody>
				<PromptInputTextarea
					ref={textareaRef}
					name="message"
					value={input}
					placeholder="Ask anything"
					onChange={(event) => setInput(event.currentTarget.value)}
					className={cn(
						"min-h-12 text-base md:text-base",
						PROMPT_INPUT_PADDING_X,
					)}
				/>
			</PromptInputBody>

			<PromptInputFooter className={PROMPT_INPUT_FOOTER_PADDING_X}>
				<PromptInputTools>
					<PromptInputActionMenu>
						<PromptInputActionMenuTrigger
							aria-label="Add attachments"
							className={cn(TOOLBAR_CONTROL_SIZE, TOOLBAR_MUTED_TEXT)}
						>
							<Plus className={TOOLBAR_ICON_SIZE} />
						</PromptInputActionMenuTrigger>
						<PromptInputActionMenuContent>
							<PromptInputActionAddAttachments />
						</PromptInputActionMenuContent>
					</PromptInputActionMenu>
				</PromptInputTools>

				<div className="ml-auto flex items-center gap-1">
					<PromptInputSelect
						onValueChange={(value) => handleModelChange(String(value))}
						value={modelId}
					>
						<PromptInputSelectTrigger
							size="sm"
							className={cn(
								buttonVariants({ variant: "ghost", size: "sm" }),
								TOOLBAR_CONTROL_HEIGHT,
								"w-auto px-2.5 border-none shadow-none focus-visible:ring-0 dark:bg-transparent [&>svg:last-child]:hidden",
							)}
						>
							<PromptInputSelectValue />
						</PromptInputSelectTrigger>
						<PromptInputSelectContent side="top" align="end">
							<PromptInputSelectGroup>
								{AI_CHAT_MODELS.map((item) => (
									<PromptInputSelectItem key={item.id} value={item.id}>
										{item.name}
									</PromptInputSelectItem>
								))}
							</PromptInputSelectGroup>
						</PromptInputSelectContent>
					</PromptInputSelect>

					<AiChatPromptSubmit input={input} onStop={onStop} status={status} />
				</div>
			</PromptInputFooter>
		</PromptInput>
	);
}
