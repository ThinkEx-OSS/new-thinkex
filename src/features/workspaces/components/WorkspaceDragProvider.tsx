import { PointerActivationConstraints } from "@dnd-kit/dom";
import {
	DragDropProvider,
	KeyboardSensor,
	PointerSensor,
} from "@dnd-kit/react";
import type { ReactNode } from "react";

import type { MoveWorkspaceItemInput } from "#/features/workspaces/contracts";
import {
	type DndDragEndEvent,
	getWorkspaceDragCommand,
	getWorkspaceItemMoveInput,
	getWorkspaceItemTabInsertInput,
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
	workspaceId: string;
	onMoveItem: (input: MoveWorkspaceItemInput) => void;
	onOpenItemInNewTab: (input: {
		item: WorkspaceItem;
		insertIndex: number;
	}) => void;
	onWorkspaceDragCommand: (command: WorkspaceDragCommand) => void;
}

export default function WorkspaceDragProvider({
	children,
	items,
	workspaceId,
	onMoveItem,
	onOpenItemInNewTab,
	onWorkspaceDragCommand,
}: WorkspaceDragProviderProps) {
	const handleDragEnd = (event: DndDragEndEvent) => {
		const command = getWorkspaceDragCommand(event);

		if (command) {
			onWorkspaceDragCommand(command);
			return;
		}

		const tabInsertInput = getWorkspaceItemTabInsertInput({
			event,
			items,
		});

		if (tabInsertInput) {
			onOpenItemInNewTab(tabInsertInput);
			return;
		}

		const moveInput = getWorkspaceItemMoveInput({
			event,
			items,
			workspaceId,
		});

		if (moveInput) {
			onMoveItem(moveInput);
		}
	};

	return (
		<DragDropProvider sensors={workspaceDragSensors} onDragEnd={handleDragEnd}>
			{children}
		</DragDropProvider>
	);
}
