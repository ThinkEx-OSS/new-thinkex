import { PointerActivationConstraints } from "@dnd-kit/dom";
import {
	DragDropProvider,
	KeyboardSensor,
	PointerSensor,
} from "@dnd-kit/react";
import type { ReactNode } from "react";

import type { MoveWorkspaceItemsInput } from "#/features/workspaces/contracts";
import {
	type DndDragEndEvent,
	getWorkspaceDropIntent,
	shouldPreventWorkspacePointerActivation,
	type WorkspaceDragCommand,
} from "#/features/workspaces/model/drag";
import type { WorkspaceItem } from "#/features/workspaces/model/types";

const workspaceDragSensors = [
	PointerSensor.configure({
		activationConstraints(event) {
			if (event.pointerType === "touch") {
				return [
					new PointerActivationConstraints.Delay({
						value: 250,
						tolerance: 5,
					}),
				];
			}

			return [new PointerActivationConstraints.Distance({ value: 6 })];
		},
		preventActivation(event, source) {
			return shouldPreventWorkspacePointerActivation(event, source);
		},
	}),
	KeyboardSensor,
];

interface WorkspaceDragProviderProps {
	children: ReactNode;
	items: WorkspaceItem[];
	selectedItemIds?: ReadonlySet<string>;
	workspaceId: string;
	onAddItemsToAiContext?: (input: {
		clearSelection: boolean;
		itemIds: string[];
	}) => void;
	onMoveItems: (input: MoveWorkspaceItemsInput) => void;
	onOpenItemInNewTab: (input: {
		item: WorkspaceItem;
		insertIndex: number;
	}) => void;
	onWorkspaceDragCommand: (command: WorkspaceDragCommand) => void;
}

export default function WorkspaceDragProvider({
	children,
	items,
	selectedItemIds,
	workspaceId,
	onAddItemsToAiContext,
	onMoveItems,
	onOpenItemInNewTab,
	onWorkspaceDragCommand,
}: WorkspaceDragProviderProps) {
	const handleDragEnd = (event: DndDragEndEvent) => {
		const intent = getWorkspaceDropIntent({
			event,
			items,
			selectedItemIds,
			workspaceId,
		});

		if (!intent) {
			return;
		}

		switch (intent.kind) {
			case "workspace-drag-command":
				onWorkspaceDragCommand(intent.command);
				break;
			case "add-items-to-ai-context":
				onAddItemsToAiContext?.(intent.input);
				break;
			case "open-item-in-new-tab":
				onOpenItemInNewTab(intent.input);
				break;
			case "move-items":
				onMoveItems(intent.input);
				break;
		}
	};

	return (
		<DragDropProvider sensors={workspaceDragSensors} onDragEnd={handleDragEnd}>
			{children}
		</DragDropProvider>
	);
}
