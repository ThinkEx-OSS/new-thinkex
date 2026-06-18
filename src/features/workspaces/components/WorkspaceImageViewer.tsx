import { useCallback, useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Spinner } from "#/components/ui/spinner";
import {
	WorkspaceCaptureShortcuts,
	WorkspaceCaptureViewerFrame,
} from "#/features/workspaces/components/WorkspaceCaptureChrome";
import { useFileItemToolbar } from "#/features/workspaces/components/WorkspaceItemToolbarSlot";
import { WorkspaceImageRegionCaptureOverlay } from "#/features/workspaces/components/WorkspaceRegionCaptureOverlay";
import { renderImageRegionCapture } from "#/features/workspaces/components/workspace-image-capture";
import { createCaptureAttachmentFile } from "#/features/workspaces/components/workspace-region-capture";
import { stageCaptureAttachmentToComposerWithFeedback } from "#/features/workspaces/composer/workspace-composer-actions";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import { getWorkspaceFileContentUrl } from "#/features/workspaces/model/workspace-file-registry";
import { cn } from "#/lib/utils";

const IMAGE_VIEWER_MIN_SCALE = 0.25;
const IMAGE_VIEWER_MAX_SCALE = 8;
const IMAGE_VIEWER_WHEEL_STEP = 0.05;
const IMAGE_VIEWER_PINCH_STEP = 3;

interface WorkspaceImageViewerProps {
	item: WorkspaceItem;
	toolbarSlotId?: string;
	workspaceId: string;
}

export default function WorkspaceImageViewer({
	item,
	toolbarSlotId,
	workspaceId,
}: WorkspaceImageViewerProps) {
	const fileUrl = getWorkspaceFileContentUrl(workspaceId, item.id);

	return (
		<WorkspaceImageViewerContent
			key={fileUrl}
			fileUrl={fileUrl}
			item={item}
			toolbarSlotId={toolbarSlotId}
			workspaceId={workspaceId}
		/>
	);
}

function WorkspaceImageViewerContent({
	fileUrl,
	item,
	toolbarSlotId,
	workspaceId,
}: {
	fileUrl: string;
	item: WorkspaceItem;
	toolbarSlotId?: string;
	workspaceId: string;
}) {
	const viewerRef = useRef<HTMLDivElement>(null);
	const imageRef = useRef<HTMLImageElement>(null);
	const [status, setStatus] = useState<"loading" | "ready" | "error">(
		"loading",
	);
	const [isCaptureActive, setIsCaptureActive] = useState(false);

	useFileItemToolbar({
		capture: {
			isActive: isCaptureActive,
			onToggle: () => setIsCaptureActive((current) => !current),
		},
		fileName: item.name,
		fileUrl,
		slotId: toolbarSlotId ?? item.id,
	});

	const handleImageLoad = useCallback(() => {
		setStatus("ready");
	}, []);

	const handleCapture = useCallback(
		async (region: Parameters<typeof renderImageRegionCapture>[1]) => {
			const image = imageRef.current;
			const viewer = viewerRef.current;

			if (!image || !viewer) {
				throw new Error("Image viewer is not ready.");
			}

			const blob = await renderImageRegionCapture(image, region, viewer);
			stageCaptureAttachmentToComposerWithFeedback(
				workspaceId,
				createCaptureAttachmentFile({
					blob,
					fileName: item.name,
					suffix: "capture",
				}),
			);
		},
		[item.name, workspaceId],
	);

	return (
		<div
			ref={viewerRef}
			className={cn(
				"relative h-full min-h-0 overflow-hidden bg-background",
				isCaptureActive && "cursor-crosshair",
			)}
		>
			{status === "loading" ? (
				<div className="absolute inset-0 flex items-center justify-center">
					<Spinner className="size-4" />
				</div>
			) : null}
			{status === "error" ? (
				<div className="flex h-full items-center justify-center">
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
				</div>
			) : (
				<TransformWrapper
					key={fileUrl}
					initialScale={1}
					minScale={IMAGE_VIEWER_MIN_SCALE}
					maxScale={IMAGE_VIEWER_MAX_SCALE}
					centerOnInit
					limitToBounds={false}
					smooth={false}
					wheel={{ step: IMAGE_VIEWER_WHEEL_STEP }}
					pinch={{ step: IMAGE_VIEWER_PINCH_STEP }}
					panning={{
						allowLeftClickPan: !isCaptureActive,
						allowMiddleClickPan: true,
						activationKeys: isCaptureActive ? [" "] : [],
					}}
					doubleClick={{ disabled: true }}
				>
					<TransformComponent
						wrapperClass="!h-full !w-full"
						contentClass="!h-full !w-full"
					>
						<img
							ref={imageRef}
							alt={item.name}
							className="h-full w-full select-none object-contain"
							draggable={false}
							src={fileUrl}
							onError={() => {
								setStatus("error");
							}}
							onLoad={handleImageLoad}
						/>
					</TransformComponent>
				</TransformWrapper>
			)}
			{status === "ready" ? (
				<WorkspaceImageRegionCaptureOverlay
					active={isCaptureActive}
					boundsRef={viewerRef}
					onCapture={handleCapture}
				/>
			) : null}
			<WorkspaceCaptureViewerFrame active={isCaptureActive} />
			<WorkspaceCaptureShortcuts
				isActive={isCaptureActive}
				onExit={() => setIsCaptureActive(false)}
				onToggle={() => setIsCaptureActive((current) => !current)}
			/>
		</div>
	);
}
