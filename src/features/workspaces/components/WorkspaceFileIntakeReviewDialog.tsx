import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
	const title =
		mode === "chat_fallback"
			? "Some files can't be attached to chat"
			: "Some files couldn't be added to the workspace";
	const description =
		mode === "chat_fallback"
			? workspaceFallbackFiles.length > 0
				? "Supported files can be added to your workspace instead."
				: "These files can't be attached to chat or added to this workspace."
			: "Unsupported or oversized files were skipped.";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4">
					{workspaceFallbackFiles.length > 0 ? (
						<WorkspaceFileReviewSection
							title="Can be added to workspace"
							files={workspaceFallbackFiles}
						/>
					) : null}
					{rejectedFiles.length > 0 ? (
						<WorkspaceFileReviewSection title="Can't be added" files={rejectedFiles} />
					) : null}
				</div>

				<DialogFooter>
					{mode === "chat_fallback" && workspaceFallbackFiles.length > 0 ? (
						<>
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={mode === "chat_fallback" ? onConfirmWorkspaceFallback : undefined}
							>
								Add supported files to workspace
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

function WorkspaceFileReviewSection({
	title,
	files,
}: {
	title: string;
	files: ReviewedIncomingFile[];
}) {
	return (
		<section className="grid gap-2">
			<h3 className="font-medium text-sm">{title}</h3>
			<ul className="grid gap-2">
				{files.map((item) => (
					<li
						key={`${item.filename}-${item.reasonCode}-${item.file.size}-${item.file.lastModified}`}
						className="rounded-lg border border-border/70 px-3 py-2"
					>
						<p className="truncate font-medium text-sm">{item.filename}</p>
						<p className="text-muted-foreground text-xs leading-relaxed">{item.message}</p>
					</li>
				))}
			</ul>
		</section>
	);
}
