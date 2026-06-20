import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

import {
	DEFAULT_IMAGE_VIEWER_TRANSFORM,
	IMAGE_VIEWER_MAX_SCALE,
	IMAGE_VIEWER_MIN_SCALE,
	type ImageViewerTransform,
	setupImageViewerGestures,
} from "#/features/workspaces/components/workspace-image-viewer-gestures";

export function useWorkspaceImageViewerTransform({
	enabled,
	isCaptureActive,
}: {
	enabled: boolean;
	isCaptureActive: boolean;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [transform, setTransform] = useState<ImageViewerTransform>(
		DEFAULT_IMAGE_VIEWER_TRANSFORM,
	);
	const transformRef = useRef(transform);
	const isCaptureActiveRef = useRef(isCaptureActive);
	const spacePressedRef = useRef(false);

	transformRef.current = transform;
	isCaptureActiveRef.current = isCaptureActive;

	useEffect(() => {
		const container = containerRef.current;
		if (!container || !enabled) {
			return;
		}

		return setupImageViewerGestures({
			container,
			getPolicy: () => ({
				allowPrimaryPointerPan: true,
				enabled: true,
				primaryPointerPanRequiresSpace: isCaptureActiveRef.current,
			}),
			getTransform: () => transformRef.current,
			maxScale: IMAGE_VIEWER_MAX_SCALE,
			minScale: IMAGE_VIEWER_MIN_SCALE,
			setTransform,
			spacePressed: spacePressedRef,
		});
	}, [enabled]);

	const contentStyle = useMemo(
		() => ({
			height: "100%",
			transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
			transformOrigin: "0 0",
			width: "100%",
		}),
		[transform.scale, transform.x, transform.y],
	);

	return {
		containerRef: containerRef as RefObject<HTMLDivElement>,
		contentStyle,
		spacePressedRef,
	};
}

export { IMAGE_VIEWER_MAX_SCALE, IMAGE_VIEWER_MIN_SCALE };
