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
				"group/card gap-0 overflow-hidden border-2 border-dashed border-muted-foreground/35 bg-muted/10 py-0 shadow-none ring-0 transition-all hover:border-foreground/35 hover:bg-muted/20 dark:border-muted-foreground/30 dark:bg-muted/5 dark:hover:bg-muted/10",
				className,
			)}
		>
			<button
				type="button"
				className="flex w-full cursor-pointer flex-col rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				disabled={disabled}
				onClick={onCreate}
			>
				<div className="flex aspect-[5/2] items-center justify-center transition-all duration-200">
					<Plus
						className="size-11 text-muted-foreground transition-colors group-hover/card:text-foreground"
						strokeWidth={1.75}
					/>
				</div>

				<CardHeader className="gap-2 px-4 py-3">
					<CardTitle>Create workspace</CardTitle>
					<CardDescription className="text-xs">
						Start something new
					</CardDescription>
				</CardHeader>
			</button>
		</Card>
	);
}
