import type { RefObject } from "react";
import { useWorkspaceRegionCaptureOverlay } from "#/features/workspaces/components/use-workspace-region-capture-overlay";
import { WorkspaceCaptureSelectionRect } from "#/features/workspaces/components/WorkspaceCaptureSelectionRect";
import type { WorkspaceRegionRect } from "#/features/workspaces/components/workspace-region-capture";

/** Image viewer: listeners attach to the outer pan/zoom container. */
export function WorkspaceImageRegionCaptureOverlay({
	active,
	boundsRef,
	onCapture,
	shouldDeferPointer,
}: {
	active: boolean;
	boundsRef: RefObject<HTMLElement | null>;
	onCapture: (region: WorkspaceRegionRect) => Promise<void>;
	shouldDeferPointer?: () => boolean;
}) {
	const { selectionRect, visible } = useWorkspaceRegionCaptureOverlay({
		active,
		boundsRef,
		onCapture,
		shouldDeferPointer,
	});

	if (!visible) {
		return null;
	}

	return (
		<div className="pointer-events-none absolute inset-0 z-[60]">
			{selectionRect ? (
				<WorkspaceCaptureSelectionRect region={selectionRect} />
			) : null}
		</div>
	);
}

/** @deprecated Use WorkspaceImageRegionCaptureOverlay */
export const WorkspaceRegionCaptureOverlay = WorkspaceImageRegionCaptureOverlay;
