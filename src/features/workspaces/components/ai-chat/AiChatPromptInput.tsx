import { ArrowUp, FileText, Plus, Square, X } from "lucide-react";
import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useEffect,
	useRef,
	useState,
} from "react";

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
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
	usePromptInputAttachments,
} from "#/components/ai-elements/prompt-input";
import { buttonVariants } from "#/components/ui/button";
import {
	AI_CHAT_MODELS,
	DEFAULT_WORKSPACE_AI_CHAT_MODEL_ID,
} from "#/features/workspaces/components/ai-chat/constants";
import type {
	AiChatModelId,
	AiChatStatus,
} from "#/features/workspaces/components/ai-chat/types";
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
const SEND_BUTTON_SIZE = "size-8";
const SEND_ICON_SIZE = "size-4";

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

function useTypeToFocusPrompt({
	enabled,
	setInput,
	textareaRef,
}: {
	enabled: boolean;
	setInput: Dispatch<SetStateAction<string>>;
	textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
	const pendingCaretPositionRef = useRef<number | null>(null);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (!shouldRouteTypingToPrompt(event)) {
				return;
			}

			const textarea = textareaRef.current;
			if (!textarea || textarea.disabled || textarea.readOnly) {
				return;
			}

			event.preventDefault();
			setInput((currentInput) => {
				const nextInput = `${currentInput}${event.key}`;
				pendingCaretPositionRef.current = nextInput.length;
				return nextInput;
			});

			requestAnimationFrame(() => {
				const promptTextarea = textareaRef.current;
				if (!promptTextarea) {
					return;
				}

				const caretPosition =
					pendingCaretPositionRef.current ?? promptTextarea.value.length;
				pendingCaretPositionRef.current = null;
				promptTextarea.focus({ preventScroll: true });
				promptTextarea.setSelectionRange(caretPosition, caretPosition);
			});
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [enabled, setInput, textareaRef]);
}

function shouldRouteTypingToPrompt(event: KeyboardEvent) {
	if (
		event.defaultPrevented ||
		event.metaKey ||
		event.ctrlKey ||
		event.altKey ||
		event.isComposing
	) {
		return false;
	}

	if (event.key.length !== 1 || event.key === " ") {
		return false;
	}

	if (document.querySelector(ACTIVE_LAYER_SELECTOR)) {
		return false;
	}

	const activeElement = document.activeElement;
	return (
		!activeElement ||
		activeElement === document.body ||
		activeElement === document.documentElement ||
		activeElement.matches(PROMPT_TYPE_TO_FOCUS_SURFACE_SELECTOR)
	);
}

const ACTIVE_LAYER_SELECTOR = [
	'[data-slot="alert-dialog-content"][data-open]',
	'[data-slot="context-menu-content"][data-open]',
	'[data-slot="dialog-content"][data-open]',
	'[data-slot="dropdown-menu-content"][data-open]',
	'[data-slot="select-content"][data-open]',
].join(",");
const PROMPT_TYPE_TO_FOCUS_SURFACE_SELECTOR =
	"[data-prompt-type-to-focus-surface]";

function AiChatPromptAttachments() {
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

function AiChatPromptSubmit({
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
	const canStop = isGenerating && Boolean(onStop);

	return (
		<PromptInputSubmit
			className={cn(SEND_BUTTON_SIZE, "rounded-full")}
			disabled={isGenerating ? !canStop : !hasContent}
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
