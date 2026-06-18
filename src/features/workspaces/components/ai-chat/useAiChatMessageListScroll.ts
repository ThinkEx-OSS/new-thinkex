import {
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { VListHandle } from "virtua";

import type { AiChatMessage } from "#/features/workspaces/components/ai-chat/types";

interface UseAiChatMessageListScrollInput {
	bottomRowIndex: number;
	latestUserMessageId: string | undefined;
	latestUserMessageIndex: number;
	messageCount: number;
	pinActive: boolean;
	viewportRootRef: RefObject<HTMLElement | null>;
}

export function useAiChatMessageListScroll({
	bottomRowIndex,
	latestUserMessageId,
	latestUserMessageIndex,
	messageCount,
	pinActive,
	viewportRootRef,
}: UseAiChatMessageListScrollInput) {
	const virtualListRef = useRef<VListHandle>(null);
	const initialBottomScrollAppliedRef = useRef(false);
	const pinnedUserMessageIdRef = useRef<string | null>(null);
	const [pinnedBlankSize, setPinnedBlankSize] = useState(0);
	const [pinnedUserSize, setPinnedUserSize] = useState(0);

	const pinnedSpacerMinHeight = Math.max(0, pinnedBlankSize - pinnedUserSize);
	const pinnedSpacerStyle =
		pinnedSpacerMinHeight > 0
			? { minHeight: pinnedSpacerMinHeight }
			: undefined;

	const measurePinnedUserRow = (element: HTMLDivElement | null) => {
		if (!element) {
			return;
		}

		const nextSize = element.getBoundingClientRect().height;
		setPinnedUserSize((currentSize) =>
			currentSize === nextSize ? currentSize : nextSize,
		);
	};

	useLayoutEffect(() => {
		if (initialBottomScrollAppliedRef.current || messageCount === 0) {
			return;
		}

		if (bottomRowIndex < 0) {
			return;
		}

		const scrollToBottom = () => {
			pinnedUserMessageIdRef.current = latestUserMessageId ?? null;
			virtualListRef.current?.scrollToIndex(bottomRowIndex, { align: "end" });
			initialBottomScrollAppliedRef.current = true;
		};

		scrollToBottom();
		const frame = requestAnimationFrame(scrollToBottom);

		return () => {
			cancelAnimationFrame(frame);
		};
	}, [bottomRowIndex, latestUserMessageId, messageCount]);

	useEffect(() => {
		if (
			!latestUserMessageId ||
			latestUserMessageIndex < 0 ||
			!pinActive ||
			pinnedUserMessageIdRef.current === latestUserMessageId
		) {
			return;
		}

		pinnedUserMessageIdRef.current = latestUserMessageId;
		setPinnedUserSize(0);

		const frame = requestAnimationFrame(() => {
			const virtualList = virtualListRef.current;

			setPinnedBlankSize(
				virtualList?.viewportSize ||
					viewportRootRef.current?.parentElement?.clientHeight ||
					0,
			);
			virtualList?.scrollToIndex(latestUserMessageIndex, {
				align: "start",
				smooth: true,
			});
		});

		return () => {
			cancelAnimationFrame(frame);
		};
	}, [latestUserMessageId, latestUserMessageIndex, pinActive, viewportRootRef]);

	return {
		measurePinnedUserRow,
		pinnedSpacerStyle,
		virtualListRef,
	};
}

export function getLatestUserMessage(messages: AiChatMessage[]) {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];

		if (message?.role === "user") {
			return message;
		}
	}
}
