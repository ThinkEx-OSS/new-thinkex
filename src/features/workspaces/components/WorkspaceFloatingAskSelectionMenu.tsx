import { createPortal } from "react-dom";

import { WorkspaceAskSelectionButton } from "#/features/workspaces/components/WorkspaceAskSelectionButton";
import { cn } from "#/lib/utils";

type SelectionRect = Pick<DOMRect, "height" | "left" | "top" | "width">;

const ASK_SELECTION_MENU_HEIGHT = 32;
const ASK_SELECTION_MENU_WIDTH = 78;
const ASK_SELECTION_MENU_OFFSET = 8;
const ASK_SELECTION_MENU_VIEWPORT_MARGIN = 8;
const ASK_SELECTION_MENU_LAYER_CLASSNAME = "z-[49]";

export function WorkspaceFloatingAskSelectionMenu({
	className,
	onAsk,
	rect,
}: {
	className?: string;
	onAsk: () => void;
	rect: SelectionRect;
}) {
	if (typeof document === "undefined" || typeof window === "undefined") {
		return null;
	}

	const placement = getAskSelectionMenuPlacement(rect, {
		viewportHeight: window.innerHeight,
		viewportWidth: window.innerWidth,
	});

	return createPortal(
		<div
			className={cn("fixed", ASK_SELECTION_MENU_LAYER_CLASSNAME, className)}
			style={{
				left: placement.left,
				top: placement.top,
				transform: "translateX(-50%)",
			}}
		>
			<WorkspaceAskSelectionButton onClick={onAsk} />
		</div>,
		document.body,
	);
}

function getAskSelectionMenuPlacement(
	rect: SelectionRect,
	viewport: {
		viewportHeight: number;
		viewportWidth: number;
	},
) {
	const minCenterX =
		ASK_SELECTION_MENU_VIEWPORT_MARGIN + ASK_SELECTION_MENU_WIDTH / 2;
	const maxCenterX =
		viewport.viewportWidth -
		ASK_SELECTION_MENU_VIEWPORT_MARGIN -
		ASK_SELECTION_MENU_WIDTH / 2;
	const selectionCenterX = rect.left + rect.width / 2;
	const aboveTop =
		rect.top - ASK_SELECTION_MENU_OFFSET - ASK_SELECTION_MENU_HEIGHT;
	const belowTop = rect.top + rect.height + ASK_SELECTION_MENU_OFFSET;
	const canPlaceAbove = aboveTop >= ASK_SELECTION_MENU_VIEWPORT_MARGIN;
	const canPlaceBelow =
		belowTop + ASK_SELECTION_MENU_HEIGHT <=
		viewport.viewportHeight - ASK_SELECTION_MENU_VIEWPORT_MARGIN;
	const preferredTop = canPlaceAbove || !canPlaceBelow ? aboveTop : belowTop;

	return {
		left: clamp(selectionCenterX, minCenterX, maxCenterX),
		top: clamp(
			preferredTop,
			ASK_SELECTION_MENU_VIEWPORT_MARGIN,
			viewport.viewportHeight -
				ASK_SELECTION_MENU_VIEWPORT_MARGIN -
				ASK_SELECTION_MENU_HEIGHT,
		),
	};
}

function clamp(value: number, min: number, max: number) {
	if (max < min) {
		return min;
	}

	return Math.min(Math.max(value, min), max);
}
