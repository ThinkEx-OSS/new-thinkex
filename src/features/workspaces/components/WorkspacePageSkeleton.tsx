import { Link } from "@tanstack/react-router";

import ThinkExLogo from "#/components/ThinkExLogo";
import { WorkspaceFrame } from "#/features/workspaces/components/WorkspaceLayout";

const workspaceSkeletonCardIds = [
	"folder",
	"document",
	"pdf",
	"audio",
	"notes",
	"quiz",
	"flashcards",
	"source",
] as const;

export default function WorkspacePageSkeleton() {
	return (
		<WorkspaceFrame
			chrome={<WorkspaceChromeSkeleton />}
			content={<WorkspaceContentSkeleton />}
			chatPanel={<AiChatPanelSkeleton />}
		/>
	);
}

function WorkspaceChromeSkeleton() {
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
						<SkeletonBlock className="h-8 w-32 rounded-md" />
						<SkeletonBlock className="h-4 w-px shrink-0 rounded-none" />
						<SkeletonBlock className="h-8 w-28 rounded-md" />
						<SkeletonBlock className="hidden h-4 w-px shrink-0 rounded-none sm:block" />
						<SkeletonBlock className="hidden h-8 w-24 rounded-md sm:block" />
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<SkeletonBlock className="size-8 rounded-md" />
					<SkeletonBlock className="size-8 rounded-full" />
					<SkeletonBlock className="size-8 rounded-full" />
					<SkeletonBlock className="hidden h-8 w-24 rounded-md lg:block" />
				</div>
			</div>
			<WorkspaceContextBarSkeleton />
		</header>
	);
}

function WorkspaceContextBarSkeleton() {
	return (
		<div className="flex h-11 items-center justify-between gap-3 bg-workspace-chrome-active px-4 text-sm">
			<div className="flex min-w-0 items-center gap-2">
				<SkeletonBlock className="size-5 rounded-sm" />
				<SkeletonBlock className="h-4 w-32 rounded-sm" />
				<SkeletonBlock className="h-4 w-20 rounded-sm" />
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<SkeletonBlock className="h-8 w-24 rounded-md" />
				<SkeletonBlock className="size-8 rounded-md" />
			</div>
		</div>
	);
}

function WorkspaceContentSkeleton() {
	return (
		<div className="h-[calc(100vh-5.75rem)] overflow-hidden">
			<div className="space-y-5 px-4 py-3">
				<section className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
					{workspaceSkeletonCardIds.map((id) => (
						<div
							key={id}
							className="overflow-hidden rounded-md border border-border bg-card"
						>
							<SkeletonBlock className="aspect-[5/2] rounded-none" />
							<div className="space-y-3 p-5">
								<SkeletonBlock className="h-5 w-3/4 rounded-sm" />
								<SkeletonBlock className="h-3 w-1/2 rounded-sm" />
							</div>
						</div>
					))}
				</section>
			</div>
		</div>
	);
}

function AiChatPanelSkeleton() {
	return (
		<aside className="relative flex min-h-screen flex-col bg-background">
			<div className="flex h-12 items-center justify-between border-b border-border/70 px-4">
				<SkeletonBlock className="h-5 w-28 rounded-sm" />
				<div className="flex items-center gap-1">
					<SkeletonBlock className="size-8 rounded-md" />
					<SkeletonBlock className="size-8 rounded-md" />
				</div>
			</div>
			<div className="min-h-0 flex-1 px-4 pt-14 pb-5">
				<div className="space-y-3">
					<SkeletonBlock className="h-3 w-1/3 rounded-sm" />
					<SkeletonBlock className="h-3 w-1/2 rounded-sm" />
				</div>
			</div>
			<div className="px-4 pb-4">
				<div className="mx-auto w-full max-w-2xl">
					<div className="rounded-md border border-border/70 bg-muted/30 p-3">
						<SkeletonBlock className="h-16 rounded-sm" />
					</div>
				</div>
			</div>
		</aside>
	);
}

function SkeletonBlock({ className }: { className?: string }) {
	return (
		<div
			className={`animate-pulse bg-muted ${className ?? ""}`}
			aria-hidden="true"
		/>
	);
}
