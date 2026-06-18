import { useState } from "react";
import { Spinner } from "#/components/ui/spinner";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { getWorkspaceFileContentUrl } from "#/features/workspaces/model/workspace-file-registry";

interface WorkspaceImageViewerProps {
	item: WorkspaceItem;
	workspaceId: string;
}

export default function WorkspaceImageViewer({
	item,
	workspaceId,
}: WorkspaceImageViewerProps) {
	const fileUrl = getWorkspaceFileContentUrl(workspaceId, item.id);

	return (
		<WorkspaceImageViewerContent key={fileUrl} fileUrl={fileUrl} item={item} />
	);
}

function WorkspaceImageViewerContent({
	fileUrl,
	item,
}: {
	fileUrl: string;
	item: WorkspaceItem;
}) {
	const [status, setStatus] = useState<"loading" | "ready" | "error">(
		"loading",
	);

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
			<div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto">
				{status === "loading" ? (
					<div className="absolute inset-0 flex items-center justify-center">
						<Spinner className="size-4" />
					</div>
				) : null}
				{status === "error" ? (
					<div className="flex flex-col items-center gap-3 text-center text-muted-foreground text-sm">
						<p>Unable to load this image.</p>
						<a
							className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 font-medium text-foreground text-sm shadow-xs transition-colors hover:bg-muted"
							download={item.name}
							href={fileUrl}
						>
							Download original file
						</a>
					</div>
				) : (
					<img
						alt={item.name}
						className="max-h-full max-w-full object-contain"
						src={fileUrl}
						onError={() => {
							setStatus("error");
						}}
						onLoad={() => {
							setStatus("ready");
						}}
					/>
				)}
			</div>
		</div>
	);
}
