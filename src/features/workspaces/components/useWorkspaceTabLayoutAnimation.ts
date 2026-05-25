import { useCallback, useLayoutEffect, useRef } from "react";

import { WORKSPACE_SORTABLE_TAB_TRANSITION } from "#/features/workspaces/components/workspace-tab-motion";

const WORKSPACE_TAB_LAYOUT_ANIMATION_DELTA_THRESHOLD = 0.5;

export type WorkspaceTabLayoutElementHandler = (
	key: string,
	element: HTMLDivElement | null,
) => void;

export function useWorkspaceTabLayoutAnimation(input: {
	itemKeys: string[];
	enabled: boolean;
}) {
	const { itemKeys, enabled } = input;
	const itemKeySignature = itemKeys.join("\u0000");
	const elementsRef = useRef(new Map<string, HTMLDivElement>());
	const rectsRef = useRef(new Map<string, DOMRect>());
	const animationsRef = useRef(new Map<string, Animation>());

	const setItemElement = useCallback<WorkspaceTabLayoutElementHandler>(
		(key, element) => {
			if (element) {
				elementsRef.current.set(key, element);
				return;
			}

			elementsRef.current.delete(key);
			animationsRef.current.get(key)?.cancel();
			animationsRef.current.delete(key);
		},
		[],
	);

	// dnd-kit animates real sortable tab moves; this FLIP pass covers target-side projections that are not sortable sources.
	useLayoutEffect(() => {
		const currentKeys = itemKeySignature
			? itemKeySignature.split("\u0000")
			: [];
		const nextRects = new Map<string, DOMRect>();
		const activeAnimations = animationsRef.current;

		for (const animation of activeAnimations.values()) {
			animation.cancel();
		}

		activeAnimations.clear();

		for (const key of currentKeys) {
			const element = elementsRef.current.get(key);

			if (element) {
				nextRects.set(key, element.getBoundingClientRect());
			}
		}

		if (prefersReducedWorkspaceMotion() || !enabled) {
			rectsRef.current = nextRects;
			return;
		}

		for (const [key, nextRect] of nextRects) {
			const previousRect = rectsRef.current.get(key);

			if (!previousRect) {
				continue;
			}

			const deltaX = previousRect.left - nextRect.left;
			const deltaY = previousRect.top - nextRect.top;

			if (
				Math.abs(deltaX) < WORKSPACE_TAB_LAYOUT_ANIMATION_DELTA_THRESHOLD &&
				Math.abs(deltaY) < WORKSPACE_TAB_LAYOUT_ANIMATION_DELTA_THRESHOLD
			) {
				continue;
			}

			const element = elementsRef.current.get(key);

			if (!element || typeof element.animate !== "function") {
				continue;
			}

			const animation = element.animate(
				[
					{ transform: `translate(${deltaX}px, ${deltaY}px)` },
					{ transform: "translate(0, 0)" },
				],
				WORKSPACE_SORTABLE_TAB_TRANSITION,
			);

			activeAnimations.set(key, animation);
			void animation.finished
				.catch(() => undefined)
				.then(() => {
					if (activeAnimations.get(key) === animation) {
						activeAnimations.delete(key);
					}
				});
		}

		rectsRef.current = nextRects;
	}, [itemKeySignature, enabled]);

	return setItemElement;
}

function prefersReducedWorkspaceMotion() {
	return (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}
