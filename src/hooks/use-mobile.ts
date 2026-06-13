import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const mobileMediaQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function getMobileSnapshot() {
	return window.matchMedia(mobileMediaQuery).matches;
}

function getServerMobileSnapshot() {
	return false;
}

function subscribeToMobileChanges(onStoreChange: () => void) {
	const mql = window.matchMedia(mobileMediaQuery);
	mql.addEventListener("change", onStoreChange);

	return () => mql.removeEventListener("change", onStoreChange);
}

export function useIsMobile() {
	return React.useSyncExternalStore(
		subscribeToMobileChanges,
		getMobileSnapshot,
		getServerMobileSnapshot,
	);
}
