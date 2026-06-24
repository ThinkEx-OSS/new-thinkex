import type { ComponentProps, ReactNode } from "react";
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
		className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}
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
	icon?: ReactNode;
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
				{description ? <EmptyDescription>{description}</EmptyDescription> : null}
			</EmptyHeader>
		)}
	</Empty>
);
