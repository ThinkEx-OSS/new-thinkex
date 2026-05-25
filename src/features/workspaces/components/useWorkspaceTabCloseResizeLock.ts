import { useCallback, useLayoutEffect, useRef, useState } from "react";

const WORKSPACE_TAB_CLOSE_RESIZE_LOCK_TIMEOUT_MS = 1200;
const WORKSPACE_TAB_CLOSE_RESIZE_RECLAIM_CLEANUP_MS = 200;

export function useWorkspaceTabCloseResizeLock() {
	const [lockedTabWidth, setLockedTabWidth] = useState<number | null>(null);
	const [isReclaimingWidth, setIsReclaimingWidth] = useState(false);
	const lockedTabWidthRef = useRef<number | null>(null);
	const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reclaimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearReleaseTimer = useCallback(() => {
		if (!releaseTimerRef.current) {
			return;
		}

		clearTimeout(releaseTimerRef.current);
		releaseTimerRef.current = null;
	}, []);
	const clearReclaimTimer = useCallback(() => {
		if (!reclaimTimerRef.current) {
			return;
		}

		clearTimeout(reclaimTimerRef.current);
		reclaimTimerRef.current = null;
	}, []);
	const release = useCallback(() => {
		clearReleaseTimer();
		clearReclaimTimer();

		if (lockedTabWidthRef.current) {
			setIsReclaimingWidth(true);
			reclaimTimerRef.current = setTimeout(() => {
				reclaimTimerRef.current = null;
				setIsReclaimingWidth(false);
			}, WORKSPACE_TAB_CLOSE_RESIZE_RECLAIM_CLEANUP_MS);
		}

		lockedTabWidthRef.current = null;
		setLockedTabWidth(null);
	}, [clearReclaimTimer, clearReleaseTimer]);
	const lockFromElement = useCallback(
		(element: HTMLElement | null) => {
			const width = element?.getBoundingClientRect().width;

			if (!width) {
				return;
			}

			clearReleaseTimer();
			clearReclaimTimer();
			setIsReclaimingWidth(false);
			lockedTabWidthRef.current = width;
			setLockedTabWidth(width);
			releaseTimerRef.current = setTimeout(
				release,
				WORKSPACE_TAB_CLOSE_RESIZE_LOCK_TIMEOUT_MS,
			);
		},
		[clearReclaimTimer, clearReleaseTimer, release],
	);

	useLayoutEffect(
		() => () => {
			clearReleaseTimer();
			clearReclaimTimer();
		},
		[clearReclaimTimer, clearReleaseTimer],
	);

	return {
		lockedTabWidth,
		shouldAnimateResize: lockedTabWidth !== null || isReclaimingWidth,
		lockFromElement,
		release,
	};
}
