import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import type { WorkspaceClipboardIntake } from "#/features/workspaces/clipboard/workspace-clipboard-intake";

export function WorkspaceClipboardIntakeDialog({
	intake,
	open,
	onConfirm,
	onOpenChange,
}: {
	intake: WorkspaceClipboardIntake | null;
	open: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
}) {
	if (!intake) {
		return null;
	}

	const documentCount = intake.document ? 1 : 0;
	const fileCount = intake.files.length;
	const mediaSkipped = intake.document?.removedMediaCount ?? 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Create from pasted content?</DialogTitle>
				</DialogHeader>

				<div className="grid gap-4">
					<section className="grid gap-2">
						<h3 className="font-medium text-sm">Will be added to this folder</h3>
						<ul className="grid gap-2">
							{intake.document ? (
								<li className="rounded-lg border border-border/70 px-3 py-2">
									<p className="truncate font-medium text-sm">{intake.document.name}</p>
									<p className="text-muted-foreground text-xs">
										Document from{" "}
										{intake.document.source === "formatted" ? "formatted text" : "plain text"}
									</p>
								</li>
							) : null}
							{intake.files.map((file) => (
								<li
									key={`${file.name}-${file.type}-${file.size}-${file.lastModified}`}
									className="rounded-lg border border-border/70 px-3 py-2"
								>
									<p className="truncate font-medium text-sm">{file.name || "Pasted file"}</p>
									<p className="text-muted-foreground text-xs">{formatFileDescription(file)}</p>
								</li>
							))}
						</ul>
					</section>

					{mediaSkipped > 0 ? (
						<p className="text-muted-foreground text-sm">
							Embedded images or media in the copied content will be skipped.
						</p>
					) : null}
				</div>

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button type="button" onClick={onConfirm}>
						{getConfirmLabel({ documentCount, fileCount })}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function getConfirmLabel(input: { documentCount: number; fileCount: number }) {
	const total = input.documentCount + input.fileCount;

	return total > 1 ? `Create ${total} items` : "Create item";
}

function formatFileDescription(file: File) {
	const type = file.type || "File";
	const size = formatFileSize(file.size);

	return `${type} - ${size}`;
}

function formatFileSize(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	if (bytes < 1024 * 1024) {
		return `${Math.ceil(bytes / 1024)} KB`;
	}

	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
