import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useRef } from "react";

import { eventTargetsPreventTypeToFocus } from "#/lib/keyboard-event-target";

export function useTypeToFocusPrompt({
	enabled,
	setInput,
	textareaRef,
}: {
	enabled: boolean;
	setInput: Dispatch<SetStateAction<string>>;
	textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
	const pendingCaretPositionRef = useRef<number | null>(null);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (!shouldRouteTypingToPrompt(event)) {
				return;
			}

			const textarea = textareaRef.current;
			if (!textarea || textarea.disabled || textarea.readOnly) {
				return;
			}

			event.preventDefault();
			setInput((currentInput) => {
				const nextInput = `${currentInput}${event.key}`;
				pendingCaretPositionRef.current = nextInput.length;
				return nextInput;
			});

			requestAnimationFrame(() => {
				const promptTextarea = textareaRef.current;
				if (!promptTextarea) {
					return;
				}

				const caretPosition =
					pendingCaretPositionRef.current ?? promptTextarea.value.length;
				pendingCaretPositionRef.current = null;
				promptTextarea.focus({ preventScroll: true });
				promptTextarea.setSelectionRange(caretPosition, caretPosition);
			});
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [enabled, setInput, textareaRef]);
}

function shouldRouteTypingToPrompt(event: KeyboardEvent) {
	if (
		event.defaultPrevented ||
		event.metaKey ||
		event.ctrlKey ||
		event.altKey ||
		event.isComposing
	) {
		return false;
	}

	if (event.key.length !== 1) {
		return false;
	}

	return !eventTargetsPreventTypeToFocus(event);
}
