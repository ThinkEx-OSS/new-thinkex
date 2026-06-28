import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CircleQuestionMark, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { requestWorkspaceMigrationFn } from "#/features/workspaces/migration-request-functions";
import { getErrorMessage } from "#/lib/error-message";
import { cn } from "#/lib/utils";

interface MissingWorkspacesCardProps {
	className?: string;
}

export default function MissingWorkspacesCard({ className }: MissingWorkspacesCardProps) {
	const [open, setOpen] = useState(false);
	const requestWorkspaceMigration = useServerFn(requestWorkspaceMigrationFn);
	const requestMigrationMutation = useMutation({
		mutationFn: () => requestWorkspaceMigration(),
		onSuccess: () => {
			toast.success("Migration request sent.");
			setOpen(false);
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Unable to send migration request right now."));
		},
	});

	return (
		<>
			<Card
				className={cn(
					"group/card gap-0 overflow-hidden border-2 border-dashed border-muted-foreground/25 bg-muted/10 py-0 shadow-none ring-0 transition-[border-color,background-color] hover:border-foreground/30 hover:bg-muted/20 dark:border-muted-foreground/25 dark:bg-muted/5 dark:hover:bg-muted/10",
					className,
				)}
			>
				<button
					type="button"
					className="flex w-full cursor-pointer flex-col rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					onClick={() => setOpen(true)}
				>
					<div className="flex aspect-[5/2] items-center justify-center">
						<CircleQuestionMark
							className="size-10 text-muted-foreground/80 transition-colors group-hover/card:text-foreground"
							strokeWidth={1.75}
						/>
					</div>

					<CardHeader className="gap-2 px-4 py-3">
						<CardTitle>Missing workspaces?</CardTitle>
						<CardDescription className="text-xs">
							We can migrate your old ThinkEx data
						</CardDescription>
					</CardHeader>
				</button>
			</Card>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Request workspace import</DialogTitle>
						<DialogDescription>
							We will send your signed-in account details to hello@thinkex.app so the team can
							import your old workspaces to this new version of ThinkEx.
						</DialogDescription>
					</DialogHeader>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={requestMigrationMutation.isPending}
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							disabled={requestMigrationMutation.isPending}
							onClick={() => requestMigrationMutation.mutate()}
						>
							{requestMigrationMutation.isPending ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									Sending...
								</>
							) : (
								"Request import"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
