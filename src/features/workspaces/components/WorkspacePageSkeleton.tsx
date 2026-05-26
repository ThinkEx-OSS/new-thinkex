import { Link } from "@tanstack/react-router";

import ThinkExLogo from "#/components/ThinkExLogo";
import { Skeleton } from "#/components/ui/skeleton";
import {
	AiChatPanelLoadingContent,
	AiChatPanelToolbarSkeleton,
} from "#/features/workspaces/components/ai-chat/AiChatThreadSkeleton";
import { WorkspaceFrame } from "#/features/workspaces/components/WorkspaceLayout";

const workspaceSkeletonCardKeys = [
	"card-1",
	"card-2",
	"card-3",
	"card-4",
	"card-5",
	"card-6",
	"card-7",
] as const;

export default function WorkspacePageSkeleton() {
	return (
		<WorkspaceFrame
			chrome={<WorkspaceSkeletonChrome />}
			content={<WorkspaceSkeletonContent />}
			chatPanel={<WorkspaceSkeletonAiChatPanel />}
		/>
	);
}

export function WorkspaceSkeletonChrome() {
	return (
		<header className="sticky top-0 z-40 bg-background/95">
			<div className="flex h-12 w-full items-stretch justify-between gap-3 px-4">
				<div className="flex min-w-0 flex-1 items-stretch gap-4">
					<Link
						to="/home"
						preload="intent"
						className="flex shrink-0 items-center gap-3 rounded-md text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ThinkExLogo size={28} />
						<span className="text-xl font-semibold tracking-tight sm:text-2xl">
							ThinkEx
						</span>
					</Link>
					<div className="flex min-w-0 flex-1 items-center gap-1 px-1">
						<Skeleton className="h-8 w-32 rounded-md" />
						<Skeleton className="h-4 w-px shrink-0 rounded-none" />
						<Skeleton className="h-8 w-28 rounded-md" />
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Skeleton className="size-8 rounded-md" />
					<Skeleton className="size-8 rounded-full" />
				</div>
			</div>
			<WorkspaceContextBarSkeleton />
		</header>
	);
}

function WorkspaceContextBarSkeleton() {
	return (
		<div className="flex h-11 items-center justify-between gap-3 bg-workspace-chrome-active px-4 text-sm">
			<div className="flex min-w-0 items-center gap-1.5">
				<Skeleton className="size-3.5 rounded-sm" />
				<Skeleton className="h-4 w-36 rounded-sm" />
			</div>
			<div className="flex shrink-0 items-center gap-1">
				<Skeleton className="h-8 w-20 rounded-md" />
				<Skeleton className="size-8 rounded-md" />
			</div>
		</div>
	);
}

export function WorkspaceSkeletonContent() {
	return (
		<div className="h-[calc(100vh-5.75rem)] overflow-hidden">
			<div className="space-y-5 px-4 py-3">
				<section className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
					{workspaceSkeletonCardKeys.map((key) => (
						<div
							key={key}
							className="relative overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10"
						>
							<Skeleton className="aspect-[5/2] rounded-none bg-muted/45" />
							<Skeleton className="absolute top-2 right-2 size-8 rounded-md bg-muted/55" />
							<div className="space-y-2 px-4 py-3">
								<Skeleton className="h-5 w-3/4 rounded-sm bg-muted/55" />
								<Skeleton className="h-3 w-1/2 rounded-sm bg-muted/45" />
							</div>
						</div>
					))}
				</section>
			</div>
		</div>
	);
}

export function WorkspaceSkeletonAiChatPanel() {
	return (
		<aside className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
			<AiChatPanelToolbarSkeleton />
			<AiChatPanelLoadingContent />
		</aside>
	);
}
