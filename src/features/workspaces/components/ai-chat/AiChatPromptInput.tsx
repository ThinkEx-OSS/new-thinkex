import { Bug, Mic, Plus } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";

import {
	type AttachmentsContext,
	PromptInput,
	PromptInputBody,
	PromptInputButton,
	PromptInputFooter,
	PromptInputHeader,
	type PromptInputMessage,
	PromptInputSelect,
	PromptInputSelectContent,
	PromptInputSelectGroup,
	PromptInputSelectItem,
	PromptInputSelectTrigger,
	PromptInputTextarea,
	PromptInputTools,
	usePromptInputAttachments,
} from "#/components/ai-elements/prompt-input";
import { Button, buttonVariants } from "#/components/ui/button";
import type { AIInspectorSnapshot } from "#/features/workspaces/ai/ai-inspector";
import { AiChatAttachmentDropBridge } from "#/features/workspaces/components/ai-chat/AiChatAttachmentDrop";
import AiChatPromptContextBar from "#/features/workspaces/components/ai-chat/AiChatPromptContextBar";
import AiChatPromptSubmit from "#/features/workspaces/components/ai-chat/AiChatPromptSubmit";
import {
	AI_CHAT_MODELS,
	DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
	WORKSPACE_AI_CHAT_ATTACHMENT_POLICY,
} from "#/features/workspaces/components/ai-chat/constants";
import type {
	AiChatModelId,
	AiChatStatus,
} from "#/features/workspaces/components/ai-chat/types";
import { useTypeToFocusPrompt } from "#/features/workspaces/components/ai-chat/useTypeToFocusPrompt";
import type { WorkspaceAiContextScope } from "#/features/workspaces/model/workspace-ai-context";
import {
	useWorkspaceAiComposerDraftFiles,
	useWorkspaceAiComposerDraftStore,
} from "#/features/workspaces/state/workspace-ai-composer-draft-store";
import { cn } from "#/lib/utils";

// InputGroup defaults to a single horizontal row. Stack vertically so the
// footer toolbar stays visible below the textarea instead of being clipped.
const PROMPT_INPUT_GROUP_CLASSNAME =
	"h-auto flex-col border-border/70 bg-muted/30 shadow-none dark:bg-muted/30";
const PROMPT_INPUT_INLINE_PADDING = "px-3.5";
const PROMPT_INPUT_HEADER_PADDING = "px-3.5 pt-3 pb-1";
const PROMPT_INPUT_FOOTER_PADDING = "pl-2 pr-3.5 pt-1 pb-2";
const TOOLBAR_ICON_BUTTON_CLASSNAME =
	"size-8 text-muted-foreground hover:text-foreground";
const TOOLBAR_MODEL_TRIGGER_CLASSNAME =
	"h-8 w-auto border-none px-2 font-normal text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 aria-expanded:text-foreground dark:bg-transparent [&>svg:last-child]:hidden";
const TOOLBAR_ICON_SIZE = "size-4";
const TOOLBAR_PLUS_ICON_SIZE = "size-4.5";
const AiChatInspectorDialog = import.meta.env.DEV
	? lazy(async () => {
			const module = await import(
				"#/features/workspaces/components/ai-chat/AiChatInspectorDialog"
			);

			return { default: module.AiChatInspectorDialog };
		})
	: null;

function AiChatAttachmentButton() {
	const attachments = usePromptInputAttachments();

	return (
		<PromptInputButton
			aria-label="Add attachments"
			className={TOOLBAR_ICON_BUTTON_CLASSNAME}
			onClick={attachments.openFileDialog}
		>
			<Plus className={TOOLBAR_PLUS_ICON_SIZE} />
		</PromptInputButton>
	);
}

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
	const draftFiles = useWorkspaceAiComposerDraftFiles(context.workspaceId);
	const addDraftFiles = useWorkspaceAiComposerDraftStore(
		(state) => state.addFiles,
	);
	const removeDraftFile = useWorkspaceAiComposerDraftStore(
		(state) => state.removeFile,
	);
	const clearDraftFiles = useWorkspaceAiComposerDraftStore(
		(state) => state.clearFiles,
	);
	const selectedModel =
		AI_CHAT_MODELS.find((item) => item.id === modelId) ??
		AI_CHAT_MODELS.find(
			(item) => item.id === DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
		) ??
		AI_CHAT_MODELS[0];

	useTypeToFocusPrompt({
		enabled: status === "ready",
		setInput,
		textareaRef,
	});

	const attachments: Omit<AttachmentsContext, "openFileDialog"> = {
		add: (files) => {
			addDraftFiles(
				context.workspaceId,
				files,
				WORKSPACE_AI_CHAT_ATTACHMENT_POLICY,
			);
		},
		clear: () => clearDraftFiles(context.workspaceId),
		files: draftFiles,
		remove: (fileId) => removeDraftFile(context.workspaceId, fileId),
	};

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
				accept={WORKSPACE_AI_CHAT_ATTACHMENT_POLICY.accept}
				attachments={attachments}
				inputGroupClassName={PROMPT_INPUT_GROUP_CLASSNAME}
				maxFileSize={WORKSPACE_AI_CHAT_ATTACHMENT_POLICY.maxFileSize}
				maxFiles={WORKSPACE_AI_CHAT_ATTACHMENT_POLICY.maxFiles}
				multiple
				onSubmit={handleSubmit}
			>
				<AiChatAttachmentDropBridge />
				<PromptInputHeader className={PROMPT_INPUT_HEADER_PADDING}>
					<AiChatPromptContextBar context={context} />
				</PromptInputHeader>
				<PromptInputBody>
					<PromptInputTextarea
						ref={textareaRef}
						name="message"
						value={input}
						placeholder="Ask anything"
						onChange={(event) => setInput(event.currentTarget.value)}
						className={cn(
							"min-h-10 pt-2 pb-1 text-base placeholder:text-foreground/45 md:text-base",
							PROMPT_INPUT_INLINE_PADDING,
						)}
					/>
				</PromptInputBody>

				<PromptInputFooter className={PROMPT_INPUT_FOOTER_PADDING}>
					<PromptInputTools>
						<AiChatAttachmentButton />

						<PromptInputSelect
							onValueChange={(value) => handleModelChange(String(value))}
							value={modelId}
						>
							<PromptInputSelectTrigger
								size="sm"
								className={cn(
									buttonVariants({ variant: "ghost", size: "sm" }),
									TOOLBAR_MODEL_TRIGGER_CLASSNAME,
								)}
							>
								{selectedModel.name}
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
								className={TOOLBAR_ICON_BUTTON_CLASSNAME}
								aria-label="Open AI inspector"
								disabled={!activeThreadId}
								onClick={() => setIsInspectorOpen(true)}
								type="button"
							>
								<Bug className={TOOLBAR_ICON_SIZE} />
							</Button>
						) : null}
					</PromptInputTools>

					<div className="ml-auto flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon-sm"
							className={TOOLBAR_ICON_BUTTON_CLASSNAME}
							aria-label="Dictation unavailable"
							type="button"
						>
							<Mic className={TOOLBAR_ICON_SIZE} />
						</Button>
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
