const EDITABLE_TARGET_SELECTOR =
	"input, textarea, select, [contenteditable=''], [contenteditable='true']";
const OVERLAY_INTERACTION_SELECTOR =
	'[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="combobox"]';
const PREVENT_TYPE_TO_FOCUS_SELECTOR = "[data-prevent-type-to-focus]";

function isElement(target: EventTarget | null): target is Element {
	return target instanceof Element;
}

export function isEditableEventTarget(target: EventTarget | null) {
	if (!isElement(target)) {
		return false;
	}

	return Boolean(target.closest(EDITABLE_TARGET_SELECTOR));
}

export function isOverlayInteractionTarget(target: EventTarget | null) {
	if (!isElement(target)) {
		return false;
	}

	return Boolean(target.closest(OVERLAY_INTERACTION_SELECTOR));
}

export function eventTargetsPreventTypeToFocus(event: KeyboardEvent) {
	for (const node of event.composedPath()) {
		if (!isElement(node)) {
			continue;
		}

		if (
			node.closest(PREVENT_TYPE_TO_FOCUS_SELECTOR) ||
			isEditableEventTarget(node) ||
			isOverlayInteractionTarget(node)
		) {
			return true;
		}
	}

	return false;
}
