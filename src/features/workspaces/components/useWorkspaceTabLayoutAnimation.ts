import { useCallback, useLayoutEffect, useRef, useState } from "react";

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
	const [elements] = useState(() => new Map<string, HTMLDivElement>());
	const previousRectsRef = useRef<Map<string, DOMRect> | null>(null);
	const [animations] = useState(() => new Map<string, Animation>());

	const setItemElement = useCallback<WorkspaceTabLayoutElementHandler>(
		(key, element) => {
			if (element) {
				elements.set(key, element);
				return;
			}

			elements.delete(key);
			animations.get(key)?.cancel();
			animations.delete(key);
		},
		[animations, elements],
	);

	// dnd-kit animates real sortable tab moves; this FLIP pass covers target-side projections that are not sortable sources.
	useLayoutEffect(() => {
		const currentKeys = itemKeySignature
			? itemKeySignature.split("\u0000")
			: [];
		const nextRects = new Map<string, DOMRect>();

		for (const animation of animations.values()) {
			animation.cancel();
		}

		animations.clear();

		for (const key of currentKeys) {
			const element = elements.get(key);

			if (element) {
				nextRects.set(key, element.getBoundingClientRect());
			}
		}

		if (prefersReducedWorkspaceMotion() || !enabled) {
			previousRectsRef.current = nextRects;
			return;
		}

		const previousRects = previousRectsRef.current;

		for (const [key, nextRect] of nextRects) {
			const previousRect = previousRects?.get(key);

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

			const element = elements.get(key);

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

			animations.set(key, animation);
			void animation.finished
				.catch(() => undefined)
				.then(() => {
					if (animations.get(key) === animation) {
						animations.delete(key);
					}
				});
		}

		previousRectsRef.current = nextRects;
	}, [animations, elements, itemKeySignature, enabled]);

	return setItemElement;
}

function prefersReducedWorkspaceMotion() {
	return (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}
