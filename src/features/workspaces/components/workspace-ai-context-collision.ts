import type { UseDroppableInput } from "@dnd-kit/react";

import type { WorkspaceDropTargetData } from "#/features/workspaces/model/drag";

const WORKSPACE_AI_CONTEXT_COLLISION_TYPE_SHAPE_INTERSECTION = 1;
const WORKSPACE_AI_CONTEXT_COLLISION_TYPE_POINTER_INTERSECTION = 2;
export const WORKSPACE_AI_CONTEXT_COLLISION_PRIORITY = 8;
const WORKSPACE_AI_CONTEXT_EDGE_OVERSCAN = 24;

type WorkspaceAiContextCollisionPoint = {
	x: number;
	y: number;
};

type WorkspaceAiContextCollisionBounds = {
	left: number;
	right: number;
	top: number;
	bottom: number;
};

type WorkspaceAiContextCollisionDetector = NonNullable<
	UseDroppableInput<WorkspaceDropTargetData>["collisionDetector"]
>;

export const workspaceAiContextCollisionDetector: WorkspaceAiContextCollisionDetector =
	({ dragOperation, droppable }) => {
		if (!droppable.shape) {
			return null;
		}

		const pointer =
			dragOperation.position.current ?? dragOperation.shape?.current.center;

		if (
			pointer &&
			isPointInsideBounds(pointer, droppable.shape.boundingRectangle, {
				left: WORKSPACE_AI_CONTEXT_EDGE_OVERSCAN,
			})
		) {
			return {
				id: droppable.id,
				value: getInverseDistanceValue(pointer, droppable.shape.center),
				type: WORKSPACE_AI_CONTEXT_COLLISION_TYPE_POINTER_INTERSECTION,
				priority: WORKSPACE_AI_CONTEXT_COLLISION_PRIORITY,
			};
		}

		const dragShape = dragOperation.shape?.current;

		if (!dragShape) {
			return null;
		}

		const intersectionArea = dragShape.intersectionArea(droppable.shape);

		if (!intersectionArea) {
			return null;
		}

		const intersectionRatio =
			intersectionArea /
			(dragShape.area + droppable.shape.area - intersectionArea);

		return {
			id: droppable.id,
			value: intersectionRatio,
			type: WORKSPACE_AI_CONTEXT_COLLISION_TYPE_SHAPE_INTERSECTION,
			priority: WORKSPACE_AI_CONTEXT_COLLISION_PRIORITY,
		};
	};

function isPointInsideBounds(
	point: WorkspaceAiContextCollisionPoint,
	bounds: WorkspaceAiContextCollisionBounds,
	overscan: Partial<Record<"left" | "right" | "top" | "bottom", number>> = {},
) {
	return (
		point.x >= bounds.left - (overscan.left ?? 0) &&
		point.x <= bounds.right + (overscan.right ?? 0) &&
		point.y >= bounds.top - (overscan.top ?? 0) &&
		point.y <= bounds.bottom + (overscan.bottom ?? 0)
	);
}

function getInverseDistanceValue(
	point: WorkspaceAiContextCollisionPoint,
	center: WorkspaceAiContextCollisionPoint,
) {
	const dx = center.x - point.x;
	const dy = center.y - point.y;
	const distance = Math.sqrt(dx * dx + dy * dy);

	return 1 / Math.max(1, distance);
}
