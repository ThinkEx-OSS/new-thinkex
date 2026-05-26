import type { UIMessage } from "ai";
import { DownloadIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import { Button } from "#/components/ui/button.tsx";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty.tsx";
import { cn } from "#/lib/utils.ts";

export type ConversationProps = ComponentProps<"div">;

export const Conversation = ({ className, ...props }: ConversationProps) => (
	<div
		className={cn(
			"relative flex min-h-0 flex-1 flex-col overflow-hidden",
			className,
		)}
		role="log"
		{...props}
	/>
);

export type ConversationContentProps = ComponentProps<"div"> & {
	scrollClassName?: string;
};

export const ConversationContent = ({
	className,
	scrollClassName,
	...props
}: ConversationContentProps) => (
	<div
		className={cn(
			"flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-4",
			scrollClassName,
			className,
		)}
		{...props}
	/>
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
	title?: string;
	description?: string;
	icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
	className,
	title = "No messages yet",
	description = "Start a conversation to see messages here",
	icon,
	children,
	...props
}: ConversationEmptyStateProps) => (
	<Empty className={cn("size-full min-h-0 rounded-none", className)} {...props}>
		{children ?? (
			<EmptyHeader>
				{icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
				<EmptyTitle className="text-sm">{title}</EmptyTitle>
				{description ? (
					<EmptyDescription>{description}</EmptyDescription>
				) : null}
			</EmptyHeader>
		)}
	</Empty>
);

const getMessageText = (message: UIMessage): string =>
	message.parts
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("");

export type ConversationDownloadProps = Omit<
	ComponentProps<typeof Button>,
	"onClick"
> & {
	messages: UIMessage[];
	filename?: string;
	formatMessage?: (message: UIMessage, index: number) => string;
};

const defaultFormatMessage = (message: UIMessage): string => {
	const roleLabel =
		message.role.charAt(0).toUpperCase() + message.role.slice(1);
	return `**${roleLabel}:** ${getMessageText(message)}`;
};

export const messagesToMarkdown = (
	messages: UIMessage[],
	formatMessage: (
		message: UIMessage,
		index: number,
	) => string = defaultFormatMessage,
): string => messages.map((msg, i) => formatMessage(msg, i)).join("\n\n");

export const ConversationDownload = ({
	messages,
	filename = "conversation.md",
	formatMessage = defaultFormatMessage,
	className,
	children,
	...props
}: ConversationDownloadProps) => {
	const handleDownload = useCallback(() => {
		const markdown = messagesToMarkdown(messages, formatMessage);
		const blob = new Blob([markdown], { type: "text/markdown" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
	}, [messages, filename, formatMessage]);

	return (
		<Button
			className={cn(
				"absolute top-4 right-4 rounded-full dark:bg-background dark:hover:bg-muted",
				className,
			)}
			onClick={handleDownload}
			size="icon"
			type="button"
			variant="outline"
			{...props}
		>
			{children ?? <DownloadIcon className="size-4" />}
		</Button>
	);
};
