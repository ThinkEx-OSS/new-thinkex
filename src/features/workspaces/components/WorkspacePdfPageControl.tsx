import { useScroll } from "@embedpdf/plugin-scroll/react";
import { useViewportCapability } from "@embedpdf/plugin-viewport/react";
import { type FocusEvent, useEffect, useRef, useState } from "react";
import { cn } from "#/lib/utils";

const HIDE_DELAY_MS = 1500;

type AutoHideControls = {
	show: () => void;
	scheduleHide: () => void;
	pin: () => void;
	unpin: () => void;
};

function useAutoHideControls(delayMs: number): {
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

function usePdfViewportAutoHide(
	documentId: string,
	enabled: boolean,
	controls: AutoHideControls,
) {
	const { provides: viewportCapability } = useViewportCapability();

	useEffect(() => {
		if (!enabled) {
			return;
		}

		controls.scheduleHide();

		const viewport = viewportCapability?.forDocument(documentId);

		if (!viewport) {
			return;
		}

		const unsubscribeScroll = viewport.onScrollChange(controls.show);

		const unsubscribeActivity = viewport.onScrollActivity((activity) => {
			if (activity.isScrolling || activity.isSmoothScrolling) {
				controls.show();
				return;
			}

			controls.scheduleHide();
		});

		return () => {
			unsubscribeScroll();
			unsubscribeActivity();
		};
	}, [controls, documentId, enabled, viewportCapability]);
}

function clampPageNumber(value: string, fallback: number, totalPages: number) {
	const parsedPage = Number.parseInt(value, 10);

	if (!Number.isFinite(parsedPage)) {
		return fallback;
	}

	return Math.min(Math.max(parsedPage, 1), totalPages);
}

export function WorkspacePdfPageControl({
	documentId,
}: {
	documentId: string;
}) {
	const {
		provides: scroll,
		state: { currentPage, totalPages },
	} = useScroll(documentId);
	const [draftPage, setDraftPage] = useState<string | null>(null);
	const { controls, interactionHandlers, isVisible } =
		useAutoHideControls(HIDE_DELAY_MS);
	const hasPages = totalPages > 0;
	const currentPageNumber = currentPage || 1;
	const inputValue = draftPage ?? String(currentPageNumber);

	usePdfViewportAutoHide(documentId, hasPages, controls);

	function commitPage(value: string) {
		if (!hasPages) {
			return;
		}

		const nextPage = clampPageNumber(value, currentPageNumber, totalPages);

		setDraftPage(null);

		if (nextPage !== currentPageNumber) {
			scroll?.scrollToPage({
				behavior: "auto",
				pageNumber: nextPage,
			});
		}
	}

	if (!hasPages) {
		return null;
	}

	return (
		<div
			className={cn(
				"pointer-events-auto absolute right-3 bottom-3 z-20 transition-opacity duration-200",
				isVisible ? "opacity-100" : "opacity-0",
			)}
		>
			<fieldset
				className="flex h-6 min-w-0 items-center gap-0.5 rounded-full border border-border/60 bg-background/90 px-1.5 text-muted-foreground/80 text-xs shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75 has-focus-visible:border-border has-focus-visible:text-foreground"
				{...interactionHandlers}
			>
				<label className="sr-only" htmlFor={`${documentId}-pdf-page-number`}>
					Page number
				</label>
				<input
					id={`${documentId}-pdf-page-number`}
					inputMode="numeric"
					max={totalPages}
					min={1}
					onBlur={(event) => {
						commitPage(event.currentTarget.value);
					}}
					onChange={(event) => {
						setDraftPage(event.currentTarget.value.replace(/\D/g, ""));
						controls.show();
					}}
					onKeyDown={(event) => {
						if (event.key !== "Enter") {
							return;
						}

						commitPage(event.currentTarget.value);
						event.currentTarget.blur();
					}}
					type="text"
					value={inputValue}
					className="field-sizing-content h-auto min-w-3 max-w-8 border-0 bg-transparent p-0 text-center text-inherit tabular-nums outline-none focus:text-foreground"
				/>
				<span aria-hidden="true" className="text-muted-foreground/35">
					/
				</span>
				<span className="min-w-3 text-muted-foreground/55 tabular-nums">
					{totalPages}
				</span>
			</fieldset>
		</div>
	);
}
