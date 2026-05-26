import {
	Conversation,
	ConversationContent,
} from "#/components/ai-elements/conversation";
import { Skeleton } from "#/components/ui/skeleton";

const assistantSkeletonRows = ["assistant-a", "assistant-b"] as const;

interface AiChatThreadSkeletonProps {
	variant?: "messages" | "prompt";
}

export function AiChatPanelToolbarSkeleton() {
	return (
		<div className="absolute top-0 right-0 z-10 flex items-center gap-1 rounded-bl-md border border-border/70 bg-background/95 p-1 shadow-sm backdrop-blur">
			<Skeleton className="size-8.5 rounded-md" />
			<Skeleton className="size-8.5 rounded-md" />
			<Skeleton className="size-8.5 rounded-md" />
		</div>
	);
}

export function AiChatPanelLoadingContent() {
	return (
		<>
			<Conversation className="min-h-0">
				<ConversationContent
					scrollClassName="min-h-0 overscroll-contain"
					className="gap-5 px-4 pt-14 pb-5"
				>
					<AiChatThreadSkeleton />
				</ConversationContent>
			</Conversation>
			<div className="px-4 pb-4">
				<div className="mx-auto w-full max-w-2xl">
					<AiChatThreadSkeleton variant="prompt" />
				</div>
			</div>
		</>
	);
}

export default function AiChatThreadSkeleton({
	variant = "messages",
}: AiChatThreadSkeletonProps) {
	if (variant === "prompt") {
		return renderPromptSkeleton();
	}

	return (
		<div
			aria-label="Loading chat"
			className="flex flex-col gap-6"
			role="status"
		>
			{renderAssistantMessageSkeleton()}
			{renderUserMessageSkeleton()}
			{assistantSkeletonRows.map((key) => (
				<div key={key}>
					{renderAssistantMessageSkeleton({ isCompact: key === "assistant-b" })}
				</div>
			))}
		</div>
	);
}

function renderPromptSkeleton() {
	return (
		<div className="rounded-md border border-border/70 bg-muted/30 p-3 shadow-none">
			<div className="space-y-3">
				<Skeleton className="h-4 w-3/4 rounded-sm" />
				<Skeleton className="h-4 w-1/2 rounded-sm" />
				<div className="flex items-center justify-between pt-2">
					<div className="flex items-center gap-2">
						<Skeleton className="size-9 rounded-md" />
						<Skeleton className="h-9 w-24 rounded-md" />
					</div>
					<Skeleton className="size-8 rounded-md" />
				</div>
			</div>
		</div>
	);
}

function renderAssistantMessageSkeleton({
	isCompact = false,
}: {
	isCompact?: boolean;
} = {}) {
	return (
		<div className="max-w-full space-y-2">
			<Skeleton className="h-3 w-20 rounded-sm" />
			<div className="space-y-2">
				<Skeleton className="h-4 w-full rounded-sm" />
				<Skeleton className="h-4 w-11/12 rounded-sm" />
				{isCompact ? null : (
					<>
						<Skeleton className="h-4 w-4/5 rounded-sm" />
						<Skeleton className="h-4 w-2/3 rounded-sm" />
					</>
				)}
			</div>
		</div>
	);
}

function renderUserMessageSkeleton() {
	return (
		<div className="ml-auto max-w-[88%]">
			<Skeleton className="h-10 rounded-lg bg-secondary" />
		</div>
	);
}
