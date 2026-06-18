import {
	type CSSProperties,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Virtualizer, type VirtualizerHandle } from "virtua";

import { cn } from "#/lib/utils";

export interface AiChatVirtuaListScrollTarget {
	bottomRowIndex: number;
	latestUserMessageId: string | undefined;
	latestUserMessageIndex: number;
}

export interface AiChatVirtuaListRowContext {
	measurePinnedUserRow: (element: HTMLDivElement | null) => void;
	tailSpacerStyle: CSSProperties | undefined;
}

interface AiChatVirtuaListProps extends AiChatVirtuaListScrollTarget {
	children: (context: AiChatVirtuaListRowContext) => ReactNode;
	className?: string;
	pinActive: boolean;
}

function isScrolledToBottom(
	offset: number,
	scrollSize: number,
	viewportSize: number,
) {
	return offset - scrollSize + viewportSize >= -1.5;
}

/** Virtua has no onViewportReady — observe the scroll port instead of forking the package. */
function useScrollViewportHeight(scrollRef: RefObject<HTMLDivElement | null>) {
	const [height, setHeight] = useState(0);

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) {
			return;
		}

		const syncHeight = () => {
			setHeight(element.clientHeight);
		};

		syncHeight();

		const observer = new ResizeObserver(syncHeight);
		observer.observe(element);

		return () => {
			observer.disconnect();
		};
	}, [scrollRef]);

	return height;
}

/**
 * Chat list built on virtua's official story patterns (references/virtua/stories/react/advanced/):
 * - Chat.stories.tsx — flex scroll port, top flexGrow spacer, stick-to-bottom
 * - Chatbot.stories.tsx — pin latest user row, tail minHeight spacer (kept after stream)
 */
export function AiChatVirtuaList({
	bottomRowIndex,
	children,
	className,
	latestUserMessageId,
	latestUserMessageIndex,
	pinActive,
}: AiChatVirtuaListProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<VirtualizerHandle>(null);
	const shouldStickToBottomRef = useRef(true);
	const lastPinnedUserIdRef = useRef<string | null>(null);
	const viewportHeight = useScrollViewportHeight(scrollRef);
	const [pinnedTurnId, setPinnedTurnId] = useState<string | null>(null);
	const [blankSize, setBlankSize] = useState(0);
	const [lastUserSize, setLastUserSize] = useState(0);

	const isSpacerTurn =
		pinnedTurnId !== null &&
		latestUserMessageId !== undefined &&
		pinnedTurnId === latestUserMessageId;
	const tailSpacerHeight = blankSize - lastUserSize;
	const tailSpacerStyle =
		isSpacerTurn && tailSpacerHeight > 0
			? { minHeight: tailSpacerHeight }
			: undefined;

	const measurePinnedUserRow = useCallback(
		(element: HTMLDivElement | null) => {
			if (!element || !isSpacerTurn) {
				return;
			}

			setLastUserSize(element.getBoundingClientRect().height);
		},
		[isSpacerTurn],
	);

	const onScroll = useCallback((offset: number) => {
		const handle = listRef.current;
		if (!handle) {
			return;
		}

		shouldStickToBottomRef.current = isScrolledToBottom(
			offset,
			handle.scrollSize,
			handle.viewportSize,
		);
	}, []);

	useEffect(() => {
		const handle = listRef.current;
		if (
			viewportHeight === 0 ||
			!handle ||
			bottomRowIndex < 0 ||
			pinActive ||
			!shouldStickToBottomRef.current
		) {
			return;
		}

		handle.scrollToIndex(bottomRowIndex, { align: "end" });
	}, [bottomRowIndex, pinActive, viewportHeight]);

	useEffect(() => {
		if (
			viewportHeight === 0 ||
			!pinActive ||
			!latestUserMessageId ||
			latestUserMessageIndex < 0 ||
			lastPinnedUserIdRef.current === latestUserMessageId
		) {
			return;
		}

		const handle = listRef.current;
		if (!handle) {
			return;
		}

		lastPinnedUserIdRef.current = latestUserMessageId;
		setPinnedTurnId(latestUserMessageId);
		setLastUserSize(0);
		setBlankSize(viewportHeight);
		shouldStickToBottomRef.current = false;

		const frame = requestAnimationFrame(() => {
			listRef.current?.scrollToIndex(latestUserMessageIndex, {
				align: "start",
				smooth: true,
			});
		});

		return () => {
			cancelAnimationFrame(frame);
		};
	}, [latestUserMessageId, latestUserMessageIndex, pinActive, viewportHeight]);

	return (
		<div
			ref={scrollRef}
			className={cn(
				"flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-5 pb-5 [overflow-anchor:none]",
				className,
			)}
		>
			{isSpacerTurn ? null : (
				<div aria-hidden className="min-h-0 flex-1 shrink-0" />
			)}
			<Virtualizer ref={listRef} scrollRef={scrollRef} onScroll={onScroll}>
				{children({ measurePinnedUserRow, tailSpacerStyle })}
			</Virtualizer>
		</div>
	);
}

export function deriveAiChatListScrollTarget(
	rows: ReadonlyArray<{ type: string; message?: { id: string } }>,
	messages: Array<{ id: string; role: string }>,
): AiChatVirtuaListScrollTarget {
	const latestUserMessage = getLatestUserMessage(messages);

	return {
		bottomRowIndex: rows.length - 1,
		latestUserMessageId: latestUserMessage?.id,
		latestUserMessageIndex: latestUserMessage
			? rows.findIndex(
					(row) =>
						row.type === "message" && row.message?.id === latestUserMessage.id,
				)
			: -1,
	};
}

function getLatestUserMessage<T extends { id: string; role: string }>(
	messages: T[],
) {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];

		if (message?.role === "user") {
			return message;
		}
	}
}
