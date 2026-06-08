import { type PointerEvent, useRef, useState } from "react";

type WorkspaceMarqueePoint = {
	x: number;
	y: number;
};

export type WorkspaceMarqueeRect = WorkspaceMarqueePoint & {
	width: number;
	height: number;
};

type WorkspaceMarqueeState = {
	pointerId: number;
	start: WorkspaceMarqueePoint;
	current: WorkspaceMarqueePoint;
	baseSelectedItemIds: ReadonlySet<string>;
	started: boolean;
};

type WorkspaceMarqueeSelectionInput = {
	selectedItemIds: ReadonlySet<string>;
	setSelectedItemIds: (itemIds: Iterable<string>) => void;
};

const WORKSPACE_MARQUEE_START_THRESHOLD_PX = 4;
const WORKSPACE_MARQUEE_IGNORED_TARGET_SELECTOR =
	'button,a,input,textarea,select,[role="button"],[data-workspace-selection-item]';

export function useWorkspaceMarqueeSelection({
	selectedItemIds,
	setSelectedItemIds,
}: WorkspaceMarqueeSelectionInput) {
	const itemElementsRef = useRef(new Map<string, HTMLElement>());
	const marqueeStateRef = useRef<WorkspaceMarqueeState | null>(null);
	const [marqueeState, setMarqueeState] =
		useState<WorkspaceMarqueeState | null>(null);
	const marqueeRect = marqueeState?.started
		? getWorkspaceMarqueeRect(marqueeState.start, marqueeState.current)
		: null;
	const setCurrentMarqueeState = (next: WorkspaceMarqueeState | null) => {
		marqueeStateRef.current = next;
		setMarqueeState(next);
	};
	const registerItemElement = (itemId: string, element: HTMLElement | null) => {
		if (element) {
			itemElementsRef.current.set(itemId, element);
			return;
		}

		itemElementsRef.current.delete(itemId);
	};
	const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
		if (
			event.button !== 0 ||
			(event.target instanceof Element &&
				event.target.closest(WORKSPACE_MARQUEE_IGNORED_TARGET_SELECTOR))
		) {
			return;
		}

		event.currentTarget.focus({ preventScroll: true });
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		setCurrentMarqueeState({
			pointerId: event.pointerId,
			start: getWorkspaceMarqueePoint(event),
			current: getWorkspaceMarqueePoint(event),
			baseSelectedItemIds: new Set(selectedItemIds),
			started: false,
		});
	};
	const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
		const current = marqueeStateRef.current;

		if (!current || current.pointerId !== event.pointerId) {
			return;
		}

		const currentPoint = getWorkspaceMarqueePoint(event);
		const next = {
			...current,
			current: currentPoint,
			started:
				current.started ||
				getWorkspaceMarqueeDistance(current.start, currentPoint) >=
					WORKSPACE_MARQUEE_START_THRESHOLD_PX,
		};

		if (next.started) {
			setSelectedItemIds(
				getWorkspaceMarqueeSelection({
					baseSelectedItemIds: next.baseSelectedItemIds,
					itemElements: itemElementsRef.current,
					selectionRect: getWorkspaceMarqueeRect(next.start, next.current),
				}),
			);
		}

		setCurrentMarqueeState(next);
	};
	const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
		const current = marqueeStateRef.current;

		if (!current || current.pointerId !== event.pointerId) {
			return;
		}

		event.currentTarget.releasePointerCapture(event.pointerId);
		setCurrentMarqueeState(null);
	};

	return {
		marqueeRect,
		registerItemElement,
		surfaceProps: {
			onPointerDown: handlePointerDown,
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp,
			onPointerCancel: handlePointerUp,
		},
	};
}

function getWorkspaceMarqueePoint(
	event: PointerEvent<HTMLElement>,
): WorkspaceMarqueePoint {
	return {
		x: event.clientX,
		y: event.clientY,
	};
}

function getWorkspaceMarqueeDistance(
	first: WorkspaceMarqueePoint,
	second: WorkspaceMarqueePoint,
) {
	return Math.hypot(first.x - second.x, first.y - second.y);
}

function getWorkspaceMarqueeRect(
	first: WorkspaceMarqueePoint,
	second: WorkspaceMarqueePoint,
): WorkspaceMarqueeRect {
	const x = Math.min(first.x, second.x);
	const y = Math.min(first.y, second.y);

	return {
		x,
		y,
		width: Math.abs(first.x - second.x),
		height: Math.abs(first.y - second.y),
	};
}

function getWorkspaceMarqueeSelection({
	baseSelectedItemIds,
	itemElements,
	selectionRect,
}: {
	baseSelectedItemIds: ReadonlySet<string>;
	itemElements: ReadonlyMap<string, HTMLElement>;
	selectionRect: WorkspaceMarqueeRect;
}) {
	const selectedItemIds = new Set(baseSelectedItemIds);

	for (const [itemId, element] of itemElements) {
		if (doRectsIntersect(selectionRect, element.getBoundingClientRect())) {
			selectedItemIds.add(itemId);
		}
	}

	return selectedItemIds;
}

function doRectsIntersect(
	first: WorkspaceMarqueeRect,
	second: DOMRectReadOnly,
) {
	return (
		first.x < second.right &&
		first.x + first.width > second.left &&
		first.y < second.bottom &&
		first.y + first.height > second.top
	);
}
