/**
 * Image viewer pan/zoom gestures.
 *
 * Wheel zoom follows the same model as @embedpdf/plugin-zoom setupZoomGestures:
 * ctrl/meta + wheel uses multiplicative scale from deltaY; plain wheel pans.
 */

export const IMAGE_VIEWER_MIN_SCALE = 0.25;
export const IMAGE_VIEWER_MAX_SCALE = 8;

const WHEEL_ZOOM_SENSITIVITY = 0.01;
const WHEEL_GESTURE_END_MS = 150;
const MIN_ACCUMULATED_SCALE = 0.1;
const MAX_ACCUMULATED_SCALE = 10;

export interface ImageViewerTransform {
	scale: number;
	x: number;
	y: number;
}

export interface ImageViewerGesturePolicy {
	enabled: boolean;
	allowPrimaryPointerPan: boolean;
	primaryPointerPanRequiresSpace: boolean;
}

export const DEFAULT_IMAGE_VIEWER_TRANSFORM: ImageViewerTransform = {
	scale: 1,
	x: 0,
	y: 0,
};

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function getTouchDistance(touches: TouchList) {
	const [first, second] = [touches[0], touches[1]];
	return Math.hypot(
		second.clientX - first.clientX,
		second.clientY - first.clientY,
	);
}

function getTouchCenter(touches: TouchList) {
	const [first, second] = [touches[0], touches[1]];
	return {
		x: (first.clientX + second.clientX) / 2,
		y: (first.clientY + second.clientY) / 2,
	};
}

function getContainerPoint(
	container: HTMLElement,
	clientX: number,
	clientY: number,
) {
	const rect = container.getBoundingClientRect();
	return {
		x: clientX - rect.left,
		y: clientY - rect.top,
	};
}

function zoomTowardPoint(
	transform: ImageViewerTransform,
	pointX: number,
	pointY: number,
	nextScale: number,
): ImageViewerTransform {
	const { scale, x, y } = transform;
	if (scale === nextScale) {
		return transform;
	}

	const scaleRatio = nextScale / scale;

	return {
		scale: nextScale,
		x: pointX - (pointX - x) * scaleRatio,
		y: pointY - (pointY - y) * scaleRatio,
	};
}

export function setupImageViewerGestures({
	container,
	getPolicy,
	getTransform,
	maxScale,
	minScale,
	setTransform,
	spacePressed = { current: false },
}: {
	container: HTMLElement;
	getPolicy: () => ImageViewerGesturePolicy;
	getTransform: () => ImageViewerTransform;
	maxScale: number;
	minScale: number;
	setTransform: (transform: ImageViewerTransform) => void;
	spacePressed?: { current: boolean };
}) {
	let wheelZoomTimeout: ReturnType<typeof setTimeout> | null = null;
	let wheelGestureStartScale = 1;
	let accumulatedWheelScale = 1;

	let isPinching = false;
	let pinchStartDistance = 0;
	let pinchStartScale = 1;

	let isDragging = false;
	let dragPointerId: number | null = null;
	let dragStartClientX = 0;
	let dragStartClientY = 0;
	let dragStartTransform: ImageViewerTransform = DEFAULT_IMAGE_VIEWER_TRANSFORM;

	const applyScaleAtPoint = (
		pointX: number,
		pointY: number,
		nextScale: number,
	) => {
		const clampedScale = clamp(nextScale, minScale, maxScale);
		setTransform(zoomTowardPoint(getTransform(), pointX, pointY, clampedScale));
	};

	const canPrimaryPointerPan = () => {
		const policy = getPolicy();
		if (!policy.enabled || !policy.allowPrimaryPointerPan) {
			return false;
		}

		if (!policy.primaryPointerPanRequiresSpace) {
			return true;
		}

		return spacePressed.current;
	};

	const canMiddlePointerPan = () => getPolicy().enabled;

	const handleWheel = (event: WheelEvent) => {
		if (!getPolicy().enabled) {
			return;
		}

		if (event.ctrlKey || event.metaKey) {
			event.preventDefault();

			const point = getContainerPoint(container, event.clientX, event.clientY);

			if (wheelZoomTimeout === null) {
				wheelGestureStartScale = getTransform().scale;
				accumulatedWheelScale = 1;
			} else {
				clearTimeout(wheelZoomTimeout);
			}

			// Exponential factor stays positive for large mouse-wheel deltaY values.
			const zoomFactor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
			accumulatedWheelScale *= zoomFactor;
			accumulatedWheelScale = clamp(
				accumulatedWheelScale,
				MIN_ACCUMULATED_SCALE,
				MAX_ACCUMULATED_SCALE,
			);

			applyScaleAtPoint(
				point.x,
				point.y,
				wheelGestureStartScale * accumulatedWheelScale,
			);

			wheelZoomTimeout = setTimeout(() => {
				wheelZoomTimeout = null;
				accumulatedWheelScale = 1;
			}, WHEEL_GESTURE_END_MS);
			return;
		}

		event.preventDefault();
		const transform = getTransform();
		setTransform({
			...transform,
			x: transform.x - event.deltaX,
			y: transform.y - event.deltaY,
		});
	};

	const cancelDrag = () => {
		if (!isDragging || dragPointerId === null) {
			return;
		}

		if (container.hasPointerCapture(dragPointerId)) {
			container.releasePointerCapture(dragPointerId);
		}

		isDragging = false;
		dragPointerId = null;
	};

	const handlePointerDown = (event: PointerEvent) => {
		if (isPinching) {
			return;
		}

		if (event.button === 0 && !canPrimaryPointerPan()) {
			return;
		}

		if (event.button === 1 && !canMiddlePointerPan()) {
			return;
		}

		if (event.button !== 0 && event.button !== 1) {
			return;
		}

		isDragging = true;
		dragPointerId = event.pointerId;
		dragStartClientX = event.clientX;
		dragStartClientY = event.clientY;
		dragStartTransform = getTransform();
		container.setPointerCapture(event.pointerId);
		event.preventDefault();
	};

	const handlePointerMove = (event: PointerEvent) => {
		if (isPinching || !isDragging || event.pointerId !== dragPointerId) {
			return;
		}

		const deltaX = event.clientX - dragStartClientX;
		const deltaY = event.clientY - dragStartClientY;

		setTransform({
			...dragStartTransform,
			x: dragStartTransform.x + deltaX,
			y: dragStartTransform.y + deltaY,
		});
		event.preventDefault();
	};

	const endDrag = (event: PointerEvent) => {
		if (!isDragging || event.pointerId !== dragPointerId) {
			return;
		}

		isDragging = false;
		dragPointerId = null;

		if (container.hasPointerCapture(event.pointerId)) {
			container.releasePointerCapture(event.pointerId);
		}
	};

	const handleTouchStart = (event: TouchEvent) => {
		if (!getPolicy().enabled || event.touches.length !== 2) {
			return;
		}

		cancelDrag();
		isPinching = true;
		pinchStartDistance = getTouchDistance(event.touches);
		pinchStartScale = getTransform().scale;
		event.preventDefault();
	};

	const handleTouchMove = (event: TouchEvent) => {
		if (
			!isPinching ||
			!getPolicy().enabled ||
			event.touches.length !== 2 ||
			pinchStartDistance === 0
		) {
			return;
		}

		const center = getTouchCenter(event.touches);
		const point = getContainerPoint(container, center.x, center.y);
		const nextScale =
			pinchStartScale * (getTouchDistance(event.touches) / pinchStartDistance);

		applyScaleAtPoint(point.x, point.y, nextScale);
		event.preventDefault();
	};

	const handleTouchEnd = (event: TouchEvent) => {
		if (!isPinching || event.touches.length >= 2) {
			return;
		}

		isPinching = false;
		pinchStartDistance = 0;
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === " ") {
			spacePressed.current = true;
		}
	};

	const handleKeyUp = (event: KeyboardEvent) => {
		if (event.key === " ") {
			spacePressed.current = false;
		}
	};

	const handleWindowBlur = () => {
		spacePressed.current = false;
	};

	const passiveFalse = { passive: false } as const;

	container.addEventListener("wheel", handleWheel, passiveFalse);
	container.addEventListener("pointerdown", handlePointerDown);
	container.addEventListener("pointermove", handlePointerMove);
	container.addEventListener("pointerup", endDrag);
	container.addEventListener("pointercancel", endDrag);
	container.addEventListener("touchstart", handleTouchStart, passiveFalse);
	container.addEventListener("touchmove", handleTouchMove, passiveFalse);
	container.addEventListener("touchend", handleTouchEnd);
	container.addEventListener("touchcancel", handleTouchEnd);
	window.addEventListener("keydown", handleKeyDown);
	window.addEventListener("keyup", handleKeyUp);
	window.addEventListener("blur", handleWindowBlur);

	return () => {
		container.removeEventListener("wheel", handleWheel);
		container.removeEventListener("pointerdown", handlePointerDown);
		container.removeEventListener("pointermove", handlePointerMove);
		container.removeEventListener("pointerup", endDrag);
		container.removeEventListener("pointercancel", endDrag);
		container.removeEventListener("touchstart", handleTouchStart);
		container.removeEventListener("touchmove", handleTouchMove);
		container.removeEventListener("touchend", handleTouchEnd);
		container.removeEventListener("touchcancel", handleTouchEnd);
		window.removeEventListener("keydown", handleKeyDown);
		window.removeEventListener("keyup", handleKeyUp);
		window.removeEventListener("blur", handleWindowBlur);

		if (wheelZoomTimeout) {
			clearTimeout(wheelZoomTimeout);
		}
	};
}
