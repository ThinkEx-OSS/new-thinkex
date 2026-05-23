import { Plus } from "lucide-react";

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { cn } from "#/lib/utils";

interface CreateWorkspaceCardProps {
	className?: string;
	disabled?: boolean;
	onCreate?: () => void;
}

export default function CreateWorkspaceCard({
	className,
	disabled = false,
	onCreate,
}: CreateWorkspaceCardProps) {
	return (
		<Card
			className={cn(
				"gap-0 overflow-hidden py-0 transition-all hover:bg-accent hover:shadow-md dark:hover:bg-accent/60",
				className,
			)}
		>
			<button
				type="button"
				className="flex w-full cursor-pointer flex-col rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				disabled={disabled}
				onClick={onCreate}
			>
				<div className="flex aspect-[5/2] items-center justify-center bg-muted/30 transition-all duration-200 group-hover/card:bg-muted/70">
					<Plus className="size-11 text-muted-foreground" strokeWidth={1.75} />
				</div>

				<CardHeader className="gap-2 py-5">
					<CardTitle>Create workspace</CardTitle>
					<CardDescription className="text-xs">
						Start something new
					</CardDescription>
				</CardHeader>
			</button>
		</Card>
	);
}
