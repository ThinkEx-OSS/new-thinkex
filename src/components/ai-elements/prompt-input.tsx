import type { ChatStatus, FileUIPart } from "ai";
import {
	CornerDownLeftIcon,
	ImageIcon,
	PlusIcon,
	SquareIcon,
	XIcon,
} from "lucide-react";
import { nanoid } from "nanoid";
import type {
	ChangeEventHandler,
	ClipboardEventHandler,
	ComponentProps,
	DragEvent,
	FormEvent,
	FormEventHandler,
	HTMLAttributes,
	KeyboardEventHandler,
	ReactNode,
} from "react";
import {
	Children,
	createContext,
	use,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupTextarea,
} from "#/components/ui/input-group.tsx";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select.tsx";
import { Spinner } from "#/components/ui/spinner.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip.tsx";
import { hasNativeFiles } from "#/lib/native-file-drag";
import { cn } from "#/lib/utils.ts";

// ============================================================================
// Helpers
// ============================================================================

const convertBlobUrlToDataUrl = async (url: string): Promise<string | null> => {
	try {
		const response = await fetch(url);
		const blob = await response.blob();
		// FileReader uses callback-based API, wrapping in Promise is necessary
		// oxlint-disable-next-line eslint-plugin-promise(avoid-new)
		return new Promise((resolve) => {
			const reader = new FileReader();
			// oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
			reader.onloadend = () => resolve(reader.result as string);
			// oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
};

function fileMatchesAccept(file: File, accept: string | undefined) {
	if (!accept?.trim()) {
		return true;
	}

	return accept
		.split(",")
		.flatMap((part) => {
			const pattern = part.trim();
			return pattern ? [pattern] : [];
		})
		.some((pattern) =>
			pattern.endsWith("/*")
				? file.type.startsWith(pattern.slice(0, -1))
				: file.type === pattern,
		);
}

function handlePromptInputDragOver(event: DragEvent<HTMLFormElement>) {
	if (hasNativeFiles(event.dataTransfer)) {
		event.preventDefault();
	}
}

// ============================================================================
// Attachment Context & Types
// ============================================================================

export interface AttachmentsContext {
	files: (FileUIPart & { id: string })[];
	add: (files: File[] | FileList) => void;
	remove: (id: string) => void;
	clear: () => void;
	openFileDialog: () => void;
}

// ============================================================================
// Component Context & Hooks
// ============================================================================

const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null);

export const usePromptInputAttachments = () => {
	const context = use(LocalAttachmentsContext);
	if (!context) {
		throw new Error(
			"usePromptInputAttachments must be used within a PromptInput",
		);
	}
	return context;
};

export type PromptInputActionAddAttachmentsProps = ComponentProps<
	typeof DropdownMenuItem
> & {
	label?: string;
};

export const PromptInputActionAddAttachments = ({
	label = "Add photos or files",
	...props
}: PromptInputActionAddAttachmentsProps) => {
	const attachments = usePromptInputAttachments();

	return (
		<DropdownMenuItem
			{...props}
			onClick={(event) => {
				event.preventDefault();
				attachments.openFileDialog();
			}}
		>
			<ImageIcon className="mr-2 size-4" /> {label}
		</DropdownMenuItem>
	);
};

export interface PromptInputMessage {
	text: string;
	files: FileUIPart[];
}

export type PromptInputProps = Omit<
	HTMLAttributes<HTMLFormElement>,
	"onSubmit" | "onError"
> & {
	// e.g., "image/*" or leave undefined for any
	accept?: string;
	multiple?: boolean;
	// Minimal constraints
	maxFiles?: number;
	// bytes
	maxFileSize?: number;
	onError?: (err: {
		code: "max_files" | "max_file_size" | "accept";
		message: string;
	}) => void;
	onSubmit: (
		message: PromptInputMessage,
		event: FormEvent<HTMLFormElement>,
	) => boolean | undefined | Promise<boolean | undefined>;
	inputGroupClassName?: string;
};

export const PromptInput = ({
	className,
	inputGroupClassName,
	accept,
	multiple,
	maxFiles,
	maxFileSize,
	onError,
	onSubmit,
	children,
	...props
}: PromptInputProps) => {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);
	const filesRef = useRef(items);

	useEffect(() => {
		filesRef.current = items;
	}, [items]);

	const openFileDialog = () => {
		inputRef.current?.click();
	};

	const add = useCallback(
		(fileList: File[] | FileList) => {
			const incoming = [...fileList];
			const accepted = incoming.filter((file) =>
				fileMatchesAccept(file, accept),
			);
			if (incoming.length && accepted.length === 0) {
				onError?.({
					code: "accept",
					message: "No files match the accepted types.",
				});
				return;
			}
			const withinSize = (file: File) =>
				maxFileSize ? file.size <= maxFileSize : true;
			const sized = accepted.filter(withinSize);
			if (accepted.length > 0 && sized.length === 0) {
				onError?.({
					code: "max_file_size",
					message: "All files exceed the maximum size.",
				});
				return;
			}

			setItems((prev) => {
				const capacity =
					typeof maxFiles === "number"
						? Math.max(0, maxFiles - prev.length)
						: undefined;
				const capped =
					typeof capacity === "number" ? sized.slice(0, capacity) : sized;
				if (typeof capacity === "number" && sized.length > capacity) {
					onError?.({
						code: "max_files",
						message: "Too many files. Some were not added.",
					});
				}
				const next: (FileUIPart & { id: string })[] = [];
				for (const file of capped) {
					next.push({
						filename: file.name,
						id: nanoid(),
						mediaType: file.type,
						type: "file",
						url: URL.createObjectURL(file),
					});
				}
				return [...prev, ...next];
			});
		},
		[accept, maxFileSize, maxFiles, onError],
	);

	const remove = (id: string) =>
		setItems((prev) => {
			const found = prev.find((file) => file.id === id);
			if (found?.url) {
				URL.revokeObjectURL(found.url);
			}
			return prev.filter((file) => file.id !== id);
		});

	const clear = () => {
		setItems((prev) => {
			for (const file of prev) {
				if (file.url) {
					URL.revokeObjectURL(file.url);
				}
			}
			return [];
		});
	};

	useEffect(
		() => () => {
			for (const f of filesRef.current) {
				if (f.url) {
					URL.revokeObjectURL(f.url);
				}
			}
		},
		[],
	);

	const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
		if (event.currentTarget.files) {
			add(event.currentTarget.files);
		}
		// Reset input value to allow selecting files that were previously removed
		event.currentTarget.value = "";
	};

	const attachmentsCtx: AttachmentsContext = {
		add,
		clear,
		files: items,
		openFileDialog,
		remove,
	};

	const handleDrop = (event: DragEvent<HTMLFormElement>) => {
		if (hasNativeFiles(event.dataTransfer)) {
			event.preventDefault();
			event.stopPropagation();
		}
		if (event.dataTransfer.files.length > 0) {
			add(event.dataTransfer.files);
		}
	};

	const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
		event.preventDefault();

		const form = event.currentTarget;
		const formData = new FormData(form);
		const text = (formData.get("message") as string) || "";

		// Reset form immediately after capturing text to avoid race condition
		// where user input during async blob conversion would be lost
		form.reset();

		try {
			// Convert blob URLs to data URLs asynchronously
			const convertedFiles: FileUIPart[] = await Promise.all(
				items.map(async ({ id: _id, ...item }) => {
					if (item.url?.startsWith("blob:")) {
						const dataUrl = await convertBlobUrlToDataUrl(item.url);
						// If conversion failed, keep the original blob URL
						return {
							...item,
							url: dataUrl ?? item.url,
						};
					}
					return item;
				}),
			);

			const result = onSubmit({ files: convertedFiles, text }, event);

			// Handle both sync and async onSubmit
			if (result instanceof Promise) {
				try {
					const accepted = await result;
					if (accepted !== false) {
						clear();
					}
				} catch {
					// Don't clear on error - user may want to retry
				}
			} else if (result !== false) {
				// Sync function completed without throwing, clear inputs
				clear();
			}
		} catch {
			// Don't clear on error - user may want to retry
		}
	};

	// Render with or without local provider
	const inner = (
		<>
			<input
				accept={accept}
				aria-label="Upload files"
				className="hidden"
				multiple={multiple}
				onChange={handleChange}
				ref={inputRef}
				title="Upload files"
				type="file"
			/>
			<form
				data-prompt-input-local-drop-target=""
				className={cn("w-full", className)}
				onDragOver={handlePromptInputDragOver}
				onDrop={handleDrop}
				onSubmit={handleSubmit}
				{...props}
			>
				<InputGroup
					className={cn(
						"has-[[data-slot=input-group-control]:focus-visible]:!border-ring/60 has-[[data-slot=input-group-control]:focus-visible]:!ring-2 has-[[data-slot=input-group-control]:focus-visible]:!ring-ring/35",
						inputGroupClassName,
					)}
				>
					{children}
				</InputGroup>
			</form>
		</>
	);

	return (
		<LocalAttachmentsContext.Provider value={attachmentsCtx}>
			{inner}
		</LocalAttachmentsContext.Provider>
	);
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({
	className,
	...props
}: PromptInputBodyProps) => (
	<div className={cn("contents", className)} {...props} />
);

export type PromptInputTextareaProps = ComponentProps<
	typeof InputGroupTextarea
>;

export const PromptInputTextarea = ({
	onChange,
	onKeyDown,
	className,
	placeholder = "What would you like to know?",
	...props
}: PromptInputTextareaProps) => {
	const attachments = usePromptInputAttachments();
	const isComposingRef = useRef(false);

	const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
		// Call the external onKeyDown handler first
		onKeyDown?.(event);

		// If the external handler prevented default, don't run internal logic
		if (event.defaultPrevented) {
			return;
		}

		if (event.key === "Enter") {
			if (isComposingRef.current || event.nativeEvent.isComposing) {
				return;
			}
			if (event.shiftKey) {
				return;
			}
			event.preventDefault();

			// Check if the submit button is disabled before submitting
			const { form } = event.currentTarget;
			const submitButton = form?.querySelector(
				'button[type="submit"]',
			) as HTMLButtonElement | null;
			if (!submitButton || submitButton.disabled) {
				return;
			}

			form?.requestSubmit();
		}

		// Remove last attachment when Backspace is pressed and textarea is empty
		if (
			event.key === "Backspace" &&
			event.currentTarget.value === "" &&
			attachments.files.length > 0
		) {
			event.preventDefault();
			const lastAttachment = attachments.files.at(-1);
			if (lastAttachment) {
				attachments.remove(lastAttachment.id);
			}
		}
	};

	const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
		const items = event.clipboardData?.items;

		if (!items) {
			return;
		}

		const files: File[] = [];

		for (const item of items) {
			if (item.kind === "file") {
				const file = item.getAsFile();
				if (file) {
					files.push(file);
				}
			}
		}

		if (files.length > 0) {
			event.preventDefault();
			attachments.add(files);
		}
	};

	const handleCompositionEnd = () => {
		isComposingRef.current = false;
	};
	const handleCompositionStart = () => {
		isComposingRef.current = true;
	};

	return (
		<InputGroupTextarea
			className={cn("field-sizing-content max-h-48 min-h-16", className)}
			name="message"
			onChange={onChange}
			onCompositionEnd={handleCompositionEnd}
			onCompositionStart={handleCompositionStart}
			onKeyDown={handleKeyDown}
			onPaste={handlePaste}
			placeholder={placeholder}
			{...props}
		/>
	);
};

export type PromptInputHeaderProps = Omit<
	ComponentProps<typeof InputGroupAddon>,
	"align"
>;

export const PromptInputHeader = ({
	className,
	...props
}: PromptInputHeaderProps) => (
	<InputGroupAddon
		align="block-end"
		className={cn("order-first flex-wrap gap-1", className)}
		{...props}
	/>
);

export type PromptInputFooterProps = Omit<
	ComponentProps<typeof InputGroupAddon>,
	"align"
>;

export const PromptInputFooter = ({
	className,
	...props
}: PromptInputFooterProps) => (
	<InputGroupAddon
		align="block-end"
		className={cn("justify-between gap-1", className)}
		{...props}
	/>
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
	className,
	...props
}: PromptInputToolsProps) => (
	<div
		className={cn("flex min-w-0 items-center gap-1", className)}
		{...props}
	/>
);

export type PromptInputButtonTooltip =
	| string
	| {
			content: ReactNode;
			shortcut?: string;
			side?: ComponentProps<typeof TooltipContent>["side"];
	  };

export type PromptInputButtonProps = ComponentProps<typeof InputGroupButton> & {
	tooltip?: PromptInputButtonTooltip;
};

export const PromptInputButton = ({
	variant = "ghost",
	className,
	size,
	tooltip,
	...props
}: PromptInputButtonProps) => {
	const newSize =
		size ?? (Children.count(props.children) > 1 ? "sm" : "icon-sm");

	const button = (
		<InputGroupButton
			className={cn(className)}
			size={newSize}
			type="button"
			variant={variant}
			{...props}
		/>
	);

	if (!tooltip) {
		return button;
	}

	const tooltipContent =
		typeof tooltip === "string" ? tooltip : tooltip.content;
	const shortcut = typeof tooltip === "string" ? undefined : tooltip.shortcut;
	const side = typeof tooltip === "string" ? "top" : (tooltip.side ?? "top");

	return (
		<Tooltip>
			<TooltipTrigger render={button} />
			<TooltipContent side={side}>
				{tooltipContent}
				{shortcut && (
					<span className="ml-2 text-muted-foreground">{shortcut}</span>
				)}
			</TooltipContent>
		</Tooltip>
	);
};

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;
export const PromptInputActionMenu = (props: PromptInputActionMenuProps) => (
	<DropdownMenu {...props} />
);

export type PromptInputActionMenuTriggerProps = PromptInputButtonProps;

export const PromptInputActionMenuTrigger = ({
	className,
	children,
	...props
}: PromptInputActionMenuTriggerProps) => (
	<DropdownMenuTrigger
		render={<PromptInputButton className={className} {...props} />}
	>
		{children ?? <PlusIcon className="size-4" />}
	</DropdownMenuTrigger>
);

export type PromptInputActionMenuContentProps = ComponentProps<
	typeof DropdownMenuContent
>;
export const PromptInputActionMenuContent = ({
	className,
	...props
}: PromptInputActionMenuContentProps) => (
	<DropdownMenuContent align="start" className={cn(className)} {...props} />
);

export type PromptInputActionMenuItemProps = ComponentProps<
	typeof DropdownMenuItem
>;
export const PromptInputActionMenuItem = ({
	className,
	...props
}: PromptInputActionMenuItemProps) => (
	<DropdownMenuItem className={cn(className)} {...props} />
);

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
	status?: ChatStatus;
	onStop?: () => void;
};

export const PromptInputSubmit = ({
	className,
	variant = "default",
	size = "icon-sm",
	status,
	onStop,
	onClick,
	children,
	...props
}: PromptInputSubmitProps) => {
	const isGenerating = status === "submitted" || status === "streaming";

	let Icon = <CornerDownLeftIcon className="size-4" />;

	if (status === "submitted") {
		Icon = <Spinner />;
	} else if (status === "streaming") {
		Icon = <SquareIcon className="size-4" />;
	} else if (status === "error") {
		Icon = <XIcon className="size-4" />;
	}

	const handleClick = (
		event: Parameters<NonNullable<PromptInputSubmitProps["onClick"]>>[0],
	) => {
		if (isGenerating && onStop) {
			event.preventDefault();
			onStop();
			return;
		}
		onClick?.(event);
	};

	return (
		<InputGroupButton
			aria-label={isGenerating ? "Stop" : "Submit"}
			className={cn(className)}
			onClick={handleClick}
			size={size}
			type={isGenerating && onStop ? "button" : "submit"}
			variant={variant}
			{...props}
		>
			{children ?? Icon}
		</InputGroupButton>
	);
};

export type PromptInputSelectProps = ComponentProps<typeof Select>;

export const PromptInputSelect = (props: PromptInputSelectProps) => (
	<Select {...props} />
);

export type PromptInputSelectTriggerProps = ComponentProps<
	typeof SelectTrigger
>;

export const PromptInputSelectTrigger = ({
	className,
	...props
}: PromptInputSelectTriggerProps) => (
	<SelectTrigger
		className={cn(
			"border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors",
			"hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
			className,
		)}
		{...props}
	/>
);

export type PromptInputSelectContentProps = ComponentProps<
	typeof SelectContent
>;

export const PromptInputSelectContent = ({
	className,
	...props
}: PromptInputSelectContentProps) => (
	<SelectContent className={cn(className)} {...props} />
);

export type PromptInputSelectGroupProps = ComponentProps<typeof SelectGroup>;

export const PromptInputSelectGroup = ({
	className,
	...props
}: PromptInputSelectGroupProps) => (
	<SelectGroup className={cn(className)} {...props} />
);

export type PromptInputSelectItemProps = ComponentProps<typeof SelectItem>;

export const PromptInputSelectItem = ({
	className,
	...props
}: PromptInputSelectItemProps) => (
	<SelectItem className={cn(className)} {...props} />
);

export type PromptInputSelectValueProps = ComponentProps<typeof SelectValue>;

export const PromptInputSelectValue = ({
	className,
	...props
}: PromptInputSelectValueProps) => (
	<SelectValue className={cn(className)} {...props} />
);
