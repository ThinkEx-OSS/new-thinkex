import { useSortable } from "@dnd-kit/react/sortable";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useCallback, useRef, useState } from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuTrigger,
} from "#/components/ui/context-menu";
import { useWorkspaceTabItemInsertDropTarget } from "#/features/workspaces/components/useWorkspaceDropTarget";
import type { WorkspaceTabLayoutElementHandler } from "#/features/workspaces/components/useWorkspaceTabLayoutAnimation";
import { WorkspaceTabShell } from "#/features/workspaces/components/WorkspaceTabShell";
import { workspaceControlledSortablePlugins } from "#/features/workspaces/components/workspace-sortable-plugins";
import {
	WORKSPACE_TAB_ITEM_CLASS,
	type WorkspaceTabInsertProjection,
} from "#/features/workspaces/components/workspace-tab-bar-model";
import {
	horizontalTabCollisionDetector,
	horizontalTabInsertCollisionDetector,
	WORKSPACE_TAB_COLLISION_PRIORITY_HIGH,
} from "#/features/workspaces/components/workspace-tab-collision";
import { WORKSPACE_SORTABLE_TAB_TRANSITION } from "#/features/workspaces/components/workspace-tab-motion";
import {
	createWorkspaceTabDragData,
	WORKSPACE_TAB_DRAG_TYPE,
} from "#/features/workspaces/model/drag";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import type { WorkspaceTab } from "#/features/workspaces/state/workspace-tabs-store";
import { cn } from "#/lib/utils";

export function WorkspaceTabDivider({
	isVisible = true,
}: {
	isVisible?: boolean;
}) {
	return (
		<div
			className={cn(
				"relative z-10 h-4 w-px shrink-0 bg-border/70",
				!isVisible && "opacity-0",
			)}
			aria-hidden="true"
		/>
	);
}

export function WorkspaceTabItem({
	tab,
	index,
	layoutKey,
	setLayoutElement,
	title,
	TabIcon,
	iconClassName,
	isActive,
	showDivider,
	showDividerLine,
	showClose,
	onBeforeClose,
	onActivate,
	onClose,
	contextMenuContent,
}: {
	tab: WorkspaceTab;
	index: number;
	layoutKey: string;
	setLayoutElement: WorkspaceTabLayoutElementHandler;
	title: string;
	TabIcon: LucideIcon;
	iconClassName?: string;
	isActive: boolean;
	showDivider: boolean;
	showDividerLine: boolean;
	showClose: boolean;
	onBeforeClose: (element: HTMLElement | null) => void;
	onActivate: () => void;
	onClose: () => void;
	contextMenuContent?: ReactNode;
}) {
	const [element, setElement] = useState<Element | null>(null);
	const elementRef = useRef<HTMLDivElement | null>(null);
	const handleRef = useRef<HTMLButtonElement | null>(null);
	const setTabElement = useCallback(
		(nextElement: HTMLDivElement | null) => {
			elementRef.current = nextElement;
			setElement(nextElement);
			setLayoutElement(layoutKey, nextElement);
		},
		[layoutKey, setLayoutElement],
	);
	const handleClose = useCallback(() => {
		onBeforeClose(elementRef.current);
		onClose();
	}, [onBeforeClose, onClose]);
	const { isDragSource, isDropTarget } = useSortable({
		id: tab.id,
		index,
		element,
		handle: handleRef,
		type: WORKSPACE_TAB_DRAG_TYPE,
		accept: WORKSPACE_TAB_DRAG_TYPE,
		collisionDetector: horizontalTabCollisionDetector,
		transition: {
			...WORKSPACE_SORTABLE_TAB_TRANSITION,
			idle: false,
		},
		plugins: workspaceControlledSortablePlugins,
		data: createWorkspaceTabDragData(tab.id),
	});
	const showAttachedChrome = isActive && !isDragSource;

	const tabContent = (
		<div
			ref={setTabElement}
			className={cn(
				"relative motion-safe:will-change-transform",
				WORKSPACE_TAB_ITEM_CLASS,
				isDragSource && "opacity-70",
				isDropTarget && "rounded-md bg-muted/50",
			)}
		>
			<WorkspaceTabInsertDropHalf index={index} side="left" />
			<WorkspaceTabInsertDropHalf index={index + 1} side="right" />
			{showDivider ? <WorkspaceTabDivider isVisible={showDividerLine} /> : null}
			<WorkspaceTabShell
				title={title}
				TabIcon={TabIcon}
				iconClassName={iconClassName}
				variant={
					showAttachedChrome ? "active-attached" : isActive ? "active" : "idle"
				}
				buttonRef={handleRef}
				isDragSource={isDragSource}
				showClose={showClose}
				closeLabel={`Close ${title}`}
				onActivate={onActivate}
				onClose={handleClose}
			/>
		</div>
	);

	if (!contextMenuContent) {
		return tabContent;
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger render={tabContent} />
			<ContextMenuContent className="w-56">
				{contextMenuContent}
			</ContextMenuContent>
		</ContextMenu>
	);
}

export function WorkspaceProjectedTabItem({
	projection,
	layoutKey,
	setLayoutElement,
	showDivider,
	showDividerLine,
}: {
	projection: WorkspaceTabInsertProjection;
	layoutKey: string;
	setLayoutElement: WorkspaceTabLayoutElementHandler;
	showDivider: boolean;
	showDividerLine: boolean;
}) {
	const { Icon, iconClassName } = getWorkspaceItemDisplay(projection.item);
	const ref = useWorkspaceTabInsertDropTargetRef(
		projection.insertIndex,
		"projected",
	);
	const setProjectedElement = useCallback(
		(nextElement: HTMLDivElement | null) => {
			ref(nextElement);
			setLayoutElement(layoutKey, nextElement);
		},
		[layoutKey, ref, setLayoutElement],
	);

	return (
		<div
			ref={setProjectedElement}
			className={cn(
				WORKSPACE_TAB_ITEM_CLASS,
				"opacity-90 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-100 motion-safe:will-change-transform",
			)}
			aria-hidden
		>
			{showDivider ? <WorkspaceTabDivider isVisible={showDividerLine} /> : null}
			<WorkspaceTabShell
				title={projection.item.name}
				TabIcon={Icon}
				iconClassName={iconClassName}
				variant="projected"
			/>
		</div>
	);
}

function useWorkspaceTabInsertDropTargetRef(
	index: number,
	placement: "left" | "right" | "projected" | "tail",
) {
	const { ref } = useWorkspaceTabItemInsertDropTarget({
		index,
		placement,
		collisionDetector: horizontalTabInsertCollisionDetector,
		collisionPriority: WORKSPACE_TAB_COLLISION_PRIORITY_HIGH,
	});

	return ref;
}

function WorkspaceTabInsertDropHalf({
	index,
	side,
}: {
	index: number;
	side: "left" | "right";
}) {
	const ref = useWorkspaceTabInsertDropTargetRef(index, side);

	return (
		<span
			ref={ref}
			className={cn(
				"pointer-events-none absolute inset-y-0 z-10",
				side === "left" ? "left-0 w-1/2" : "right-0 w-1/2",
			)}
			aria-hidden="true"
		/>
	);
}

export function WorkspaceTabTailDropZone({
	children,
	index,
}: {
	children: ReactNode;
	index: number;
}) {
	const ref = useWorkspaceTabInsertDropTargetRef(index, "tail");

	return (
		<div ref={ref} className="relative flex shrink-0 items-center gap-1">
			{children}
		</div>
	);
}
