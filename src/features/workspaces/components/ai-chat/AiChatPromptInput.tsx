import { Bug, Plus } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";

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
import { Button, buttonVariants } from "#/components/ui/button";
import type { AIInspectorSnapshot } from "#/features/workspaces/ai/ai-inspector";
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
import WorkspaceAiChatContextChips from "#/features/workspaces/components/ai-chat/WorkspaceAiChatContextChips";
import type { WorkspaceAiContextScope } from "#/features/workspaces/model/workspace-ai-context";
import { cn } from "#/lib/utils";

// InputGroup defaults to a single horizontal row. Stack vertically so the
// footer toolbar stays visible below the textarea instead of being clipped.
const PROMPT_INPUT_GROUP_CLASSNAME =
	"h-auto flex-col border-border/70 bg-muted/30 shadow-none dark:bg-muted/30";
const PROMPT_INPUT_INLINE_PADDING = "px-3.5";
const PROMPT_INPUT_FOOTER_PADDING = "pl-2 pr-3.5";
const TOOLBAR_CONTROL_SIZE = "size-9";
const TOOLBAR_ICON_SIZE = "size-5";
const TOOLBAR_MUTED_TEXT = "text-muted-foreground";
const AiChatInspectorDialog = import.meta.env.DEV
	? lazy(async () => {
			const module = await import(
				"#/features/workspaces/components/ai-chat/AiChatInspectorDialog"
			);

			return { default: module.AiChatInspectorDialog };
		})
	: null;

interface AiChatPromptInputProps {
	activeThreadId?: string;
	context: WorkspaceAiContextScope;
	getInspectorSnapshot?: (threadId: string) => Promise<AIInspectorSnapshot>;
	modelId?: AiChatModelId;
	onModelChange?: (modelId: AiChatModelId) => void;
	onSubmit?: (message: PromptInputMessage) => boolean | Promise<boolean>;
	onStop?: () => void;
	status?: AiChatStatus;
}

export default function AiChatPromptInput({
	activeThreadId,
	context,
	getInspectorSnapshot,
	modelId = DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
	onModelChange,
	onSubmit,
	onStop,
	status = "ready",
}: AiChatPromptInputProps) {
	const [input, setInput] = useState("");
	const [isInspectorOpen, setIsInspectorOpen] = useState(false);
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
		<>
			<PromptInput
				inputGroupClassName={PROMPT_INPUT_GROUP_CLASSNAME}
				onSubmit={handleSubmit}
				multiple
			>
				<PromptInputHeader className={PROMPT_INPUT_INLINE_PADDING}>
					<WorkspaceAiChatContextChips context={context} />
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
							"min-h-10 py-1.5 text-base md:text-base",
							PROMPT_INPUT_INLINE_PADDING,
						)}
					/>
				</PromptInputBody>

				<PromptInputFooter className={PROMPT_INPUT_FOOTER_PADDING}>
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
									"h-8 w-auto border-none px-2 shadow-none focus-visible:ring-0 dark:bg-transparent [&>svg:last-child]:hidden",
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

						{import.meta.env.DEV && getInspectorSnapshot ? (
							<Button
								variant="ghost"
								size="icon-sm"
								className={cn("size-8", TOOLBAR_MUTED_TEXT)}
								aria-label="Open AI inspector"
								disabled={!activeThreadId}
								onClick={() => setIsInspectorOpen(true)}
								type="button"
							>
								<Bug className="size-4" />
							</Button>
						) : null}

						<AiChatPromptSubmit input={input} onStop={onStop} status={status} />
					</div>
				</PromptInputFooter>
			</PromptInput>

			{AiChatInspectorDialog && getInspectorSnapshot ? (
				<Suspense fallback={null}>
					<AiChatInspectorDialog
						getSnapshot={getInspectorSnapshot}
						open={isInspectorOpen}
						onOpenChange={setIsInspectorOpen}
						threadId={activeThreadId}
					/>
				</Suspense>
			) : null}
		</>
	);
}
