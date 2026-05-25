import { useDragOperation } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { FileQuestion, type LucideIcon, Plus, X } from "lucide-react";
import {
	type ReactNode,
	type Ref,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { Button } from "#/components/ui/button";
import { useWorkspaceTabItemInsertDropTarget } from "#/features/workspaces/components/useWorkspaceDropTarget";
import type { WorkspaceSummary } from "#/features/workspaces/contracts";
import { getWorkspaceDisplay } from "#/features/workspaces/model/display";
import {
	createWorkspaceTabDragData,
	WORKSPACE_TAB_DRAG_TYPE,
} from "#/features/workspaces/model/drag";
import {
	getWorkspaceDragProjection,
	type WorkspaceDragProjection,
} from "#/features/workspaces/model/drag-projection";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import { findItemForTab } from "#/features/workspaces/model/tabs";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import type { WorkspaceTab } from "#/features/workspaces/state/workspace-tabs-store";
import { cn } from "#/lib/utils";

const TAB_MAX_WIDTH = "16rem";
const TAB_ITEM_CLASS = "flex min-w-0 items-center gap-1";
const WORKSPACE_SORTABLE_TAB_TRANSITION = {
	duration: 160,
	easing: "cubic-bezier(0.2, 0, 0, 1)",
} as const;
const WORKSPACE_PROJECTED_TAB_ANIMATION = {
	duration: 240,
	easing: "cubic-bezier(0.25, 1, 0.5, 1)",
} as const;
const WORKSPACE_TAB_LAYOUT_ANIMATION_DELTA_THRESHOLD = 0.5;
const WORKSPACE_TAB_COLLISION_TYPE_HORIZONTAL_CENTER = 3;
const WORKSPACE_TAB_COLLISION_PRIORITY_HIGH = 3;
const WORKSPACE_TAB_SOURCE_RELEASE_RATIO = 0.58;
const WORKSPACE_TAB_VERTICAL_COLLISION_OVERSCAN = 12;

type WorkspaceTabInsertProjection = Extract<
	WorkspaceDragProjection,
	{ kind: "tab-insert" }
>;

type WorkspaceTabRenderItem =
	| {
			kind: "tab";
			tab: WorkspaceTab;
			tabIndex: number;
	  }
	| {
			kind: "projected-tab";
			projection: WorkspaceTabInsertProjection;
	  };

interface WorkspaceTabBarProps {
	workspace: WorkspaceSummary;
	itemsById: Map<string, WorkspaceItem>;
	tabs: WorkspaceTab[];
	activeTab: WorkspaceTab;
	onActivateTab: (tab: WorkspaceTab) => void;
	onCloseTab: (tab: WorkspaceTab) => void;
	onCreateRootTab: () => void;
}

export default function WorkspaceTabBar({
	workspace,
	itemsById,
	tabs,
	activeTab,
	onActivateTab,
	onCloseTab,
	onCreateRootTab,
}: WorkspaceTabBarProps) {
	const { Icon, color } = getWorkspaceDisplay(workspace);
	const dragOperation = useDragOperation();
	const projection = getWorkspaceDragProjection({
		source: dragOperation.source,
		target: dragOperation.target,
		itemsById,
	});
	const tabProjection =
		projection?.kind === "tab-insert" ? projection : undefined;
	const renderItems = getWorkspaceTabRenderItems({
		tabs,
		projection: tabProjection,
	});
	const renderItemKeys = renderItems.map(getWorkspaceTabRenderItemKey);
	const setLayoutElement = useWorkspaceTabLayoutAnimation({
		itemKeys: renderItemKeys,
		isProjectionActive: Boolean(tabProjection),
	});
	const lastRenderItem = renderItems[renderItems.length - 1];

	return (
		<nav
			className="flex min-w-0 flex-1 items-center gap-1"
			aria-label="Workspace tabs"
		>
			<div
				className="grid min-w-0 max-w-full items-center gap-1 overflow-visible"
				style={{
					gridTemplateColumns: `repeat(${renderItems.length}, minmax(0, 1fr))`,
					width: "100%",
					maxWidth: `calc(${renderItems.length} * ${TAB_MAX_WIDTH})`,
				}}
			>
				{renderItems.map((renderItem, visualIndex) => {
					const renderItemKey = getWorkspaceTabRenderItemKey(renderItem);
					const previousRenderItem = renderItems[visualIndex - 1];
					const showDivider = visualIndex > 0;
					const showDividerLine =
						showDivider &&
						!isWorkspaceTabRenderItemActive(renderItem, activeTab.id) &&
						!isWorkspaceTabRenderItemActive(previousRenderItem, activeTab.id);

					if (renderItem.kind === "projected-tab") {
						return (
							<WorkspaceProjectedTabItem
								key={renderItemKey}
								projection={renderItem.projection}
								layoutKey={renderItemKey}
								setLayoutElement={setLayoutElement}
								showDivider={showDivider}
								showDividerLine={showDividerLine}
							/>
						);
					}

					const { tab, tabIndex } = renderItem;
					const item = findItemForTab(tab, itemsById);
					const isRootTab = !tab.viewItemId;
					const itemDisplay = item ? getWorkspaceItemDisplay(item) : null;
					const TabIcon = isRootTab
						? Icon
						: (itemDisplay?.Icon ?? FileQuestion);
					const title = item?.name ?? (isRootTab ? workspace.name : tab.title);
					const iconClassName = isRootTab
						? color.text
						: (itemDisplay?.iconClassName ?? "text-muted-foreground");
					const isActive = tab.id === activeTab.id;
					return (
						<WorkspaceTabItem
							key={renderItemKey}
							tab={tab}
							index={tabIndex}
							layoutKey={renderItemKey}
							setLayoutElement={setLayoutElement}
							title={title}
							TabIcon={TabIcon}
							iconClassName={iconClassName}
							isActive={isActive}
							showDivider={showDivider}
							showDividerLine={showDividerLine}
							showClose={tabs.length > 1}
							onActivate={() => onActivateTab(tab)}
							onClose={() => onCloseTab(tab)}
						/>
					);
				})}
			</div>
			<WorkspaceTabTailDropZone index={tabs.length}>
				<WorkspaceTabDivider
					isVisible={
						!isWorkspaceTabRenderItemActive(lastRenderItem, activeTab.id)
					}
				/>
				<Button
					variant="ghost"
					size="icon-sm"
					className="shrink-0 text-muted-foreground hover:text-foreground"
					aria-label="Open new workspace tab"
					onClick={onCreateRootTab}
				>
					<Plus className="size-4" />
				</Button>
			</WorkspaceTabTailDropZone>
		</nav>
	);
}

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

function getWorkspaceTabRenderItems(input: {
	tabs: WorkspaceTab[];
	projection?: WorkspaceTabInsertProjection;
}): WorkspaceTabRenderItem[] {
	const renderItems: WorkspaceTabRenderItem[] = input.tabs.map(
		(tab, tabIndex) => ({
			kind: "tab",
			tab,
			tabIndex,
		}),
	);

	if (!input.projection) {
		return renderItems;
	}

	const insertIndex = Math.max(
		0,
		Math.min(input.projection.insertIndex, renderItems.length),
	);
	const projection =
		insertIndex === input.projection.insertIndex
			? input.projection
			: { ...input.projection, insertIndex };
	const next = renderItems.slice();

	next.splice(insertIndex, 0, {
		kind: "projected-tab",
		projection,
	});

	return next;
}

function isWorkspaceTabRenderItemActive(
	renderItem: WorkspaceTabRenderItem | undefined,
	activeTabId: string,
) {
	return renderItem?.kind === "tab" && renderItem.tab.id === activeTabId;
}

function getWorkspaceTabRenderItemKey(renderItem: WorkspaceTabRenderItem) {
	return renderItem.kind === "projected-tab"
		? `projected-tab:${renderItem.projection.source.itemId}`
		: `tab:${renderItem.tab.id}`;
}

type WorkspaceTabLayoutElementHandler = (
	key: string,
	element: HTMLDivElement | null,
) => void;

function useWorkspaceTabLayoutAnimation(input: {
	itemKeys: string[];
	isProjectionActive: boolean;
}) {
	const { itemKeys, isProjectionActive } = input;
	const itemKeySignature = itemKeys.join("\u0000");
	const elementsRef = useRef(new Map<string, HTMLDivElement>());
	const rectsRef = useRef(new Map<string, DOMRect>());
	const animationsRef = useRef(new Map<string, Animation>());

	const setItemElement = useCallback<WorkspaceTabLayoutElementHandler>(
		(key, element) => {
			if (element) {
				elementsRef.current.set(key, element);
				return;
			}

			elementsRef.current.delete(key);
			animationsRef.current.get(key)?.cancel();
			animationsRef.current.delete(key);
		},
		[],
	);

	// dnd-kit animates real sortable tab moves; this FLIP pass covers target-side projections that are not sortable sources.
	useLayoutEffect(() => {
		const currentKeys = itemKeySignature
			? itemKeySignature.split("\u0000")
			: [];
		const nextRects = new Map<string, DOMRect>();
		const activeAnimations = animationsRef.current;

		for (const animation of activeAnimations.values()) {
			animation.cancel();
		}

		activeAnimations.clear();

		for (const key of currentKeys) {
			const element = elementsRef.current.get(key);

			if (element) {
				nextRects.set(key, element.getBoundingClientRect());
			}
		}

		if (prefersReducedWorkspaceMotion()) {
			rectsRef.current = nextRects;
			return;
		}

		if (!isProjectionActive) {
			rectsRef.current = nextRects;
			return;
		}

		for (const [key, nextRect] of nextRects) {
			const previousRect = rectsRef.current.get(key);

			if (!previousRect) {
				continue;
			}

			const deltaX = previousRect.left - nextRect.left;
			const deltaY = previousRect.top - nextRect.top;

			if (
				Math.abs(deltaX) < WORKSPACE_TAB_LAYOUT_ANIMATION_DELTA_THRESHOLD &&
				Math.abs(deltaY) < WORKSPACE_TAB_LAYOUT_ANIMATION_DELTA_THRESHOLD
			) {
				continue;
			}

			const element = elementsRef.current.get(key);

			if (!element || typeof element.animate !== "function") {
				continue;
			}

			const animation = element.animate(
				[
					{ transform: `translate(${deltaX}px, ${deltaY}px)` },
					{ transform: "translate(0, 0)" },
				],
				WORKSPACE_PROJECTED_TAB_ANIMATION,
			);

			activeAnimations.set(key, animation);
			animation.addEventListener(
				"finish",
				() => {
					if (activeAnimations.get(key) === animation) {
						activeAnimations.delete(key);
					}
				},
				{ once: true },
			);
			animation.addEventListener(
				"cancel",
				() => {
					if (activeAnimations.get(key) === animation) {
						activeAnimations.delete(key);
					}
				},
				{ once: true },
			);
		}

		rectsRef.current = nextRects;
	}, [itemKeySignature, isProjectionActive]);

	return setItemElement;
}

function prefersReducedWorkspaceMotion() {
	return (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

interface WorkspaceTabItemProps {
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
	onActivate: () => void;
	onClose: () => void;
}

function WorkspaceTabItem({
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
	onActivate,
	onClose,
}: WorkspaceTabItemProps) {
	const [element, setElement] = useState<Element | null>(null);
	const handleRef = useRef<HTMLButtonElement | null>(null);
	const setTabElement = useCallback(
		(nextElement: HTMLDivElement | null) => {
			setElement(nextElement);
			setLayoutElement(layoutKey, nextElement);
		},
		[layoutKey, setLayoutElement],
	);
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
		data: createWorkspaceTabDragData(tab.id),
	});
	const showAttachedChrome = isActive && !isDragSource;

	return (
		<div
			ref={setTabElement}
			className={cn(
				"relative motion-safe:will-change-transform",
				TAB_ITEM_CLASS,
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
				onClose={onClose}
			/>
		</div>
	);
}

function WorkspaceProjectedTabItem({
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
	const { ref } = useWorkspaceTabItemInsertDropTarget({
		index: projection.insertIndex,
		placement: "projected",
		collisionDetector: horizontalTabInsertCollisionDetector,
		collisionPriority: WORKSPACE_TAB_COLLISION_PRIORITY_HIGH,
	});
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
				TAB_ITEM_CLASS,
				"opacity-90 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150 motion-safe:will-change-transform",
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

function WorkspaceTabShell({
	title,
	TabIcon,
	iconClassName,
	variant,
	buttonRef,
	isDragSource = false,
	showClose = false,
	closeLabel,
	onActivate,
	onClose,
}: {
	title: string;
	TabIcon: LucideIcon;
	iconClassName?: string;
	variant: "active-attached" | "active" | "idle" | "projected";
	buttonRef?: Ref<HTMLButtonElement>;
	isDragSource?: boolean;
	showClose?: boolean;
	closeLabel?: string;
	onActivate?: () => void;
	onClose?: () => void;
}) {
	const isActive = variant === "active" || variant === "active-attached";
	const isProjected = variant === "projected";

	return (
		<div
			className={cn(
				"group/tab flex min-w-0 flex-1 touch-none items-center border text-sm",
				variant === "active-attached" &&
					"workspace-tab-active h-8 text-foreground",
				variant === "active" &&
					"h-8 rounded-md border-transparent bg-workspace-chrome-active text-foreground",
				variant === "idle" &&
					"h-8 rounded-md border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
				isProjected &&
					"h-8 rounded-md border-primary/40 bg-primary/10 text-foreground shadow-sm",
				isDragSource && "cursor-grabbing",
			)}
		>
			<button
				ref={buttonRef}
				type="button"
				tabIndex={isProjected ? -1 : undefined}
				className={cn(
					"flex h-full min-w-0 flex-1 touch-none items-center justify-start gap-1.5 bg-transparent py-0 pr-px pl-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
					isActive && "cursor-default",
					isDragSource && "cursor-grabbing",
					isProjected && "pointer-events-none",
				)}
				onClick={onActivate}
			>
				<TabIcon
					className={cn("size-3.5 shrink-0", iconClassName)}
					strokeWidth={isProjected ? 1.75 : undefined}
					aria-hidden="true"
				/>
				<span className="truncate">{title}</span>
			</button>
			{showClose && closeLabel && onClose ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					className={cn(
						"mr-1 size-4 shrink-0 rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive focus-visible:opacity-100 group-focus-within/tab:opacity-100 group-hover/tab:opacity-100",
						isActive && "opacity-100",
					)}
					aria-label={closeLabel}
					onClick={onClose}
				>
					<X className="size-3" aria-hidden="true" />
				</Button>
			) : null}
		</div>
	);
}

function WorkspaceTabInsertDropHalf({
	index,
	side,
}: {
	index: number;
	side: "left" | "right";
}) {
	const { ref } = useWorkspaceTabItemInsertDropTarget({
		index,
		placement: side,
		collisionDetector: horizontalTabInsertCollisionDetector,
		collisionPriority: WORKSPACE_TAB_COLLISION_PRIORITY_HIGH,
	});

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

const horizontalTabCollisionDetector = ({
	dragOperation,
	droppable,
}: {
	dragOperation: {
		source?: { id?: unknown } | null;
		shape?: {
			initial?: {
				center: { x: number; y: number };
			};
			current: {
				center: { x: number; y: number };
			};
		} | null;
		position: {
			direction?: "left" | "right" | "up" | "down" | null;
			current: { x: number; y: number } | null;
		};
	};
	droppable: {
		id: string | number;
		shape?: {
			boundingRectangle: {
				left: number;
				right: number;
				top: number;
				bottom: number;
			};
			center: { x: number; y: number };
		} | null;
	};
}) => {
	if (!droppable.shape) {
		return null;
	}

	const center =
		dragOperation.shape?.current.center ?? dragOperation.position.current;

	if (!center) {
		return null;
	}

	const { boundingRectangle } = droppable.shape;

	if (
		center.y <
			boundingRectangle.top - WORKSPACE_TAB_VERTICAL_COLLISION_OVERSCAN ||
		center.y >
			boundingRectangle.bottom + WORKSPACE_TAB_VERTICAL_COLLISION_OVERSCAN
	) {
		return null;
	}

	const direction =
		dragOperation.position.direction ??
		getHorizontalDirectionFromShape(dragOperation.shape);
	const width = boundingRectangle.right - boundingRectangle.left;

	if (
		droppable.id === dragOperation.source?.id &&
		(direction === "left" || direction === "right")
	) {
		const sourceReleaseX =
			direction === "right"
				? boundingRectangle.left + width * WORKSPACE_TAB_SOURCE_RELEASE_RATIO
				: boundingRectangle.right - width * WORKSPACE_TAB_SOURCE_RELEASE_RATIO;
		const sourceShouldRelease =
			direction === "right"
				? center.x >= sourceReleaseX
				: center.x <= sourceReleaseX;

		if (sourceShouldRelease) {
			return null;
		}
	}

	const distance = Math.abs(droppable.shape.center.x - center.x);

	return {
		id: droppable.id,
		value: distance === 0 ? 1 : 1 / distance,
		type: WORKSPACE_TAB_COLLISION_TYPE_HORIZONTAL_CENTER,
		priority: WORKSPACE_TAB_COLLISION_PRIORITY_HIGH,
	};
};

const horizontalTabInsertCollisionDetector = ({
	dragOperation,
	droppable,
}: {
	dragOperation: {
		shape?: {
			current: {
				center: { x: number; y: number };
			};
		} | null;
		position: {
			current: { x: number; y: number } | null;
		};
	};
	droppable: {
		id: string | number;
		shape?: {
			boundingRectangle: {
				left: number;
				right: number;
				top: number;
				bottom: number;
			};
			center: { x: number; y: number };
		} | null;
	};
}) => {
	if (!droppable.shape) {
		return null;
	}

	const center =
		dragOperation.position.current ?? dragOperation.shape?.current.center;

	if (!center) {
		return null;
	}

	const { boundingRectangle } = droppable.shape;

	if (
		center.y <
			boundingRectangle.top - WORKSPACE_TAB_VERTICAL_COLLISION_OVERSCAN ||
		center.y >
			boundingRectangle.bottom + WORKSPACE_TAB_VERTICAL_COLLISION_OVERSCAN
	) {
		return null;
	}

	const distance = Math.abs(droppable.shape.center.x - center.x);

	return {
		id: droppable.id,
		value: distance === 0 ? 1 : 1 / distance,
		type: WORKSPACE_TAB_COLLISION_TYPE_HORIZONTAL_CENTER,
		priority: WORKSPACE_TAB_COLLISION_PRIORITY_HIGH,
	};
};

function getHorizontalDirectionFromShape(
	shape:
		| {
				initial?: { center: { x: number } };
				current: { center: { x: number } };
		  }
		| null
		| undefined,
) {
	if (!shape?.initial) {
		return null;
	}

	const delta = shape.current.center.x - shape.initial.center.x;

	if (!delta) {
		return null;
	}

	return delta > 0 ? "right" : "left";
}

function WorkspaceTabTailDropZone({
	children,
	index,
}: {
	children: ReactNode;
	index: number;
}) {
	const { ref } = useWorkspaceTabItemInsertDropTarget({
		index,
		placement: "tail",
		collisionDetector: horizontalTabInsertCollisionDetector,
		collisionPriority: WORKSPACE_TAB_COLLISION_PRIORITY_HIGH,
	});

	return (
		<div ref={ref} className="relative flex shrink-0 items-center gap-1">
			{children}
		</div>
	);
}
