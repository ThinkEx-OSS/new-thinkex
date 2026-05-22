import { Clock3, MoreVertical } from "lucide-react";

import { Button } from "#/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { getWorkspaceDisplay } from "#/features/workspaces/model/display";
import type { WorkspaceSummary } from "#/lib/api/contracts";
import { cn } from "#/lib/utils";

interface WorkspaceCardProps {
	workspace: WorkspaceSummary;
	className?: string;
	onSelect?: (workspace: WorkspaceSummary) => void;
}

export default function WorkspaceCard({
	workspace,
	className,
	onSelect,
}: WorkspaceCardProps) {
	const { Icon, accent } = getWorkspaceDisplay(workspace);

	return (
		<Card
			className={cn(
				"group/card relative gap-0 overflow-hidden py-0 transition-all hover:bg-accent hover:shadow-md dark:hover:bg-accent/60",
				className,
			)}
		>
			<button
				type="button"
				className="flex w-full cursor-pointer flex-col rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				onClick={() => onSelect?.(workspace)}
			>
				<div
					className={cn(
						"flex aspect-[5/2] items-center justify-center transition-all duration-200 group-hover/card:brightness-90",
						accent.bg,
					)}
				>
					<Icon className={cn("size-11", accent.text)} strokeWidth={1.75} />
				</div>

				<CardHeader className="gap-2 py-5">
					<CardTitle>{workspace.name}</CardTitle>
					<CardDescription className="flex items-center gap-2 text-xs">
						<Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
						<span>{workspace.updatedAt}</span>
					</CardDescription>
				</CardHeader>
			</button>

			<div
				className={cn(
					"pointer-events-none absolute top-2 right-2 z-10 opacity-0 transition-opacity",
					"group-hover/card:pointer-events-auto group-hover/card:opacity-100",
					"group-focus-within/card:pointer-events-auto group-focus-within/card:opacity-100",
					"has-[button[data-state=open]]:pointer-events-auto has-[button[data-state=open]]:opacity-100",
				)}
			>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={`Open menu for ${workspace.name}`}
							onClick={(event) => event.stopPropagation()}
						>
							<MoreVertical />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						onClick={(event) => event.stopPropagation()}
					>
						<DropdownMenuItem>Settings</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</Card>
	);
}
