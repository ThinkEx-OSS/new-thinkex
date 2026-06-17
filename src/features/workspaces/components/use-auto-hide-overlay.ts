import { type FocusEvent, useEffect, useRef, useState } from "react";

export type AutoHideControls = {
	show: () => void;
	scheduleHide: () => void;
	pin: () => void;
	unpin: () => void;
};

export function useAutoHideControls(delayMs: number): {
	controls: AutoHideControls;
	interactionHandlers: {
		onBlurCapture: (event: FocusEvent<HTMLElement>) => void;
		onFocusCapture: () => void;
		onMouseEnter: () => void;
		onMouseLeave: () => void;
	};
	isVisible: boolean;
} {
	const [isVisible, setIsVisible] = useState(true);
	const isPinnedRef = useRef(false);
	const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const controlsRef = useRef<AutoHideControls>({
		show: () => {},
		scheduleHide: () => {},
		pin: () => {},
		unpin: () => {},
	});

	controlsRef.current.show = () => {
		setIsVisible(true);

		if (hideTimeoutRef.current) {
			clearTimeout(hideTimeoutRef.current);
			hideTimeoutRef.current = null;
		}
	};

	controlsRef.current.scheduleHide = () => {
		if (hideTimeoutRef.current) {
			clearTimeout(hideTimeoutRef.current);
		}

		hideTimeoutRef.current = setTimeout(() => {
			if (!isPinnedRef.current) {
				setIsVisible(false);
			}
		}, delayMs);
	};

	controlsRef.current.pin = () => {
		isPinnedRef.current = true;
		controlsRef.current.show();
	};

	controlsRef.current.unpin = () => {
		isPinnedRef.current = false;
		controlsRef.current.scheduleHide();
	};

	useEffect(
		() => () => {
			if (hideTimeoutRef.current) {
				clearTimeout(hideTimeoutRef.current);
			}
		},
		[],
	);

	return {
		controls: controlsRef.current,
		isVisible,
		interactionHandlers: {
			onBlurCapture: (event) => {
				if (event.currentTarget.contains(event.relatedTarget)) {
					return;
				}

				controlsRef.current.unpin();
			},
			onFocusCapture: () => {
				controlsRef.current.pin();
			},
			onMouseEnter: () => {
				controlsRef.current.pin();
			},
			onMouseLeave: () => {
				controlsRef.current.unpin();
			},
		},
	};
}
