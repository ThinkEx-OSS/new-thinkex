import { Upload } from "lucide-react";
import {
	type ComponentPropsWithoutRef,
	type DragEvent,
	type ReactNode,
	useState,
} from "react";
import { useWorkspaceFileUpload } from "#/features/workspaces/components/WorkspaceFileUploadProvider";
import { workspaceFileUploadTypeLabel } from "#/features/workspaces/workspace-file-uploads";
import { cn } from "#/lib/utils";

export function WorkspaceNativeFileDropZone({
	children,
	className,
	parentId,
	...props
}: {
	children: ReactNode;
	className?: string;
	parentId: string | null;
} & ComponentPropsWithoutRef<"section">) {
	const [isDropTarget, setIsDropTarget] = useState(false);
	const { uploadFiles } = useWorkspaceFileUpload();
	const handleNativeFileDrag = (event: DragEvent<HTMLElement>) => {
		if (!hasNativeFiles(event.dataTransfer)) {
			return;
		}

		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
		setIsDropTarget(true);
	};
	const handleNativeFileDragLeave = (event: DragEvent<HTMLElement>) => {
		if (
			event.relatedTarget instanceof Node &&
			event.currentTarget.contains(event.relatedTarget)
		) {
			return;
		}

		setIsDropTarget(false);
	};
	const handleNativeFileDrop = (event: DragEvent<HTMLElement>) => {
		if (!hasNativeFiles(event.dataTransfer)) {
			return;
		}

		event.preventDefault();
		setIsDropTarget(false);
		uploadFiles(Array.from(event.dataTransfer.files), parentId);
	};

	return (
		<section
			className={cn("relative outline-none", className)}
			aria-label="Workspace content"
			onDragEnter={handleNativeFileDrag}
			onDragOver={handleNativeFileDrag}
			onDragLeave={handleNativeFileDragLeave}
			onDrop={handleNativeFileDrop}
			{...props}
		>
			{children}
			{isDropTarget ? <WorkspaceNativeFileDropOverlay /> : null}
		</section>
	);
}

function WorkspaceNativeFileDropOverlay() {
	return (
		<div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/80 p-6 backdrop-blur-[2px]">
			<div className="flex min-h-40 w-full max-w-md flex-col items-center justify-center gap-3 rounded-md border border-primary/40 border-dashed bg-card/90 px-6 py-8 text-center shadow-lg ring-1 ring-primary/15">
				<div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
					<Upload className="size-5" aria-hidden="true" />
				</div>
				<div className="space-y-1">
					<p className="font-medium text-foreground text-sm">
						Drop {workspaceFileUploadTypeLabel} to upload
					</p>
					<p className="text-muted-foreground text-xs">
						Files will be added here.
					</p>
				</div>
			</div>
		</div>
	);
}

function hasNativeFiles(dataTransfer: DataTransfer) {
	return Array.from(dataTransfer.types).includes("Files");
}
