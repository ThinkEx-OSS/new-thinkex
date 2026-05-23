import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import WorkspaceSettingsDialog from "#/features/workspaces/components/WorkspaceSettingsDialog";
import type { WorkspaceSummary } from "#/features/workspaces/contracts";
import {
	getWorkspaceDisplay,
	getWorkspaceRecencyLabel,
} from "#/features/workspaces/model/display";
import { cn } from "#/lib/utils";

interface WorkspaceCardSearch {
	tab: string | undefined;
	view: string | undefined;
}

interface WorkspaceCardProps {
	workspace: WorkspaceSummary;
	className?: string;
	search?: WorkspaceCardSearch;
}

export default function WorkspaceCard({
	workspace,
	className,
	search,
}: WorkspaceCardProps) {
	const { Icon, color } = getWorkspaceDisplay(workspace);
	const recencyLabel = getWorkspaceRecencyLabel(workspace);
	const [settingsOpen, setSettingsOpen] = useState(false);

	return (
		<>
			<Card
				className={cn(
					"group/card relative gap-0 overflow-hidden py-0 transition-all hover:bg-accent hover:shadow-md dark:hover:bg-accent/60",
					className,
				)}
			>
				<Link
					to="/workspaces/$workspaceId"
					params={{ workspaceId: workspace.id }}
					search={search ?? { tab: undefined, view: undefined }}
					preload="intent"
					className="flex w-full cursor-pointer flex-col rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<div
						className={cn(
							"flex aspect-[5/2] items-center justify-center transition-all duration-200 group-hover/card:brightness-90",
							color.bg,
						)}
					>
						<Icon className={cn("size-11", color.text)} strokeWidth={1.75} />
					</div>

					<CardHeader className="gap-2 py-5 pr-13">
						<CardTitle className="truncate">{workspace.name}</CardTitle>
						{recencyLabel ? (
							<CardDescription className="truncate text-xs">
								<span suppressHydrationWarning>{recencyLabel}</span>
							</CardDescription>
						) : null}
					</CardHeader>
				</Link>

				<div
					className={cn(
						"pointer-events-none absolute right-3 bottom-4 z-10 opacity-0 transition-opacity",
						"group-hover/card:pointer-events-auto group-hover/card:opacity-100",
						"group-focus-within/card:pointer-events-auto group-focus-within/card:opacity-100",
						"has-[button[data-state=open]]:pointer-events-auto has-[button[data-state=open]]:opacity-100",
					)}
				>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={`Open settings for ${workspace.name}`}
						onClick={(event) => {
							event.stopPropagation();
							setSettingsOpen(true);
						}}
					>
						<Settings />
					</Button>
				</div>
			</Card>
			<WorkspaceSettingsDialog
				workspace={workspace}
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
			/>
		</>
	);
}
