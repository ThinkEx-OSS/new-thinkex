import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, use, useState } from "react";
import { Streamdown } from "streamdown";
import { cn } from "#/lib/utils.ts";

import { MarkdownCodeBlock } from "./code-block";
import { Shimmer } from "./shimmer";

interface ReasoningContextValue {
	isStreaming: boolean;
	duration: number | undefined;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
	const context = use(ReasoningContext);
	if (!context) {
		throw new Error("Reasoning components must be used within Reasoning");
	}
	return context;
};

export type ReasoningProps = Omit<
	ComponentProps<"details">,
	"onToggle" | "open"
> & {
	isStreaming?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	duration?: number;
};

export function Reasoning({
	className,
	isStreaming = false,
	open,
	defaultOpen,
	onOpenChange,
	duration: durationProp,
	children,
	...props
}: ReasoningProps) {
	const [uncontrolledOpen, setUncontrolledOpen] = useState(
		defaultOpen ?? false,
	);
	const isOpen = open ?? uncontrolledOpen;

	const setIsOpen = (nextOpen: boolean) => {
		if (open === undefined) {
			setUncontrolledOpen(nextOpen);
		}
		onOpenChange?.(nextOpen);
	};

	return (
		<ReasoningContext.Provider value={{ duration: durationProp, isStreaming }}>
			<details
				className={cn("not-prose group mb-4", className)}
				onToggle={(event) => setIsOpen(event.currentTarget.open)}
				open={isOpen}
				{...props}
			>
				{children}
			</details>
		</ReasoningContext.Provider>
	);
}

export type ReasoningTriggerProps = ComponentProps<"summary"> & {
	getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode;
};

const defaultGetThinkingMessage = (isStreaming: boolean, duration?: number) => {
	if (isStreaming || duration === 0) {
		return (
			<Shimmer as="span" duration={1}>
				Thinking...
			</Shimmer>
		);
	}
	if (duration === undefined) {
		return <span>Thought for a few seconds</span>;
	}
	return <span>Thought for {duration} seconds</span>;
};

export function ReasoningTrigger({
	className,
	children,
	getThinkingMessage = defaultGetThinkingMessage,
	...props
}: ReasoningTriggerProps) {
	const { isStreaming, duration } = useReasoning();

	return (
		<summary
			className={cn(
				"flex cursor-pointer list-none items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden",
				className,
			)}
			{...props}
		>
			{children ?? (
				<>
					<BrainIcon className="size-4" />
					{getThinkingMessage(isStreaming, duration)}
					<ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
				</>
			)}
		</summary>
	);
}

export type ReasoningContentProps = ComponentProps<"div"> & {
	children: string;
};

const streamdownPlugins = { cjk, math };
const streamdownComponents = { code: MarkdownCodeBlock };
const streamdownLinkSafety = { enabled: false };

export function ReasoningContent({
	className,
	children,
	...props
}: ReasoningContentProps) {
	return (
		<div
			className={cn("mt-4 text-muted-foreground text-sm", className)}
			{...props}
		>
			<Streamdown
				components={streamdownComponents}
				linkSafety={streamdownLinkSafety}
				plugins={streamdownPlugins}
			>
				{children}
			</Streamdown>
		</div>
	);
}
