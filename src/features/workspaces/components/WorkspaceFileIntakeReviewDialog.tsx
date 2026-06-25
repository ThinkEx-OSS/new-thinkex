import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import type { ReviewedIncomingFile } from "#/features/workspaces/files/file-intake-review";

interface WorkspaceFileIntakeReviewDialogBaseProps {
	open: boolean;
	workspaceFallbackFiles: ReviewedIncomingFile[];
	rejectedFiles: ReviewedIncomingFile[];
	onOpenChange: (open: boolean) => void;
}

type WorkspaceFileIntakeReviewDialogProps =
	| (WorkspaceFileIntakeReviewDialogBaseProps & {
			mode: "chat_fallback";
			onConfirmWorkspaceFallback: () => void;
	  })
	| (WorkspaceFileIntakeReviewDialogBaseProps & {
			mode: "workspace_rejection";
			onConfirmWorkspaceFallback?: never;
	  });

export function WorkspaceFileIntakeReviewDialog({
	open,
	mode,
	workspaceFallbackFiles,
	rejectedFiles,
	onConfirmWorkspaceFallback,
	onOpenChange,
}: WorkspaceFileIntakeReviewDialogProps) {
	const hasWorkspaceFallback = workspaceFallbackFiles.length > 0;

	const title =
		mode === "chat_fallback" && hasWorkspaceFallback
			? "Add to workspace instead?"
			: "Couldn't add files";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
					{workspaceFallbackFiles.map((item) => (
						<li
							key={`${item.filename}-${item.file.size}-${item.file.lastModified}`}
							className="truncate"
						>
							{item.filename}
						</li>
					))}
					{rejectedFiles.map((item) => (
						<li
							key={`${item.filename}-${item.reasonCode}-${item.file.size}-${item.file.lastModified}`}
							className="text-muted-foreground"
						>
							<span className="text-foreground">{item.filename}</span>
							{" — "}
							{item.message}
						</li>
					))}
				</ul>

				<DialogFooter>
					{mode === "chat_fallback" && hasWorkspaceFallback ? (
						<>
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button type="button" onClick={onConfirmWorkspaceFallback}>
								Add to workspace
							</Button>
						</>
					) : (
						<Button type="button" onClick={() => onOpenChange(false)}>
							OK
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
