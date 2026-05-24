import { useSortable } from "@dnd-kit/react/sortable";
import { FileQuestion, type LucideIcon, Plus, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "#/components/ui/button";
import type { WorkspaceSummary } from "#/features/workspaces/contracts";
import { getWorkspaceDisplay } from "#/features/workspaces/model/display";
import { WORKSPACE_TAB_DRAG_TYPE } from "#/features/workspaces/model/drag";
import { getWorkspaceItemDisplay } from "#/features/workspaces/model/item-display";
import { findItemForTab } from "#/features/workspaces/model/tabs";
import type { WorkspaceItem } from "#/features/workspaces/model/types";
import type { WorkspaceTab } from "#/features/workspaces/state/workspace-tabs-store";
import { cn } from "#/lib/utils";

const TAB_MAX_WIDTH = "16rem";
const TAB_ITEM_CLASS = "flex min-w-0 items-center gap-1";

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
	const lastTab = tabs[tabs.length - 1];

	return (
		<nav
			className="flex min-w-0 flex-1 items-center gap-1"
			aria-label="Workspace tabs"
		>
			<div
				className="grid min-w-0 max-w-full items-center gap-1 overflow-visible"
				style={{
					gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
					width: "100%",
					maxWidth: `calc(${tabs.length} * ${TAB_MAX_WIDTH})`,
				}}
			>
				{tabs.map((tab, index) => {
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
					const previousTab = tabs[index - 1];
					const showDivider = index > 0;
					const showDividerLine =
						showDivider &&
						tab.id !== activeTab.id &&
						previousTab?.id !== activeTab.id;

					return (
						<WorkspaceTabItem
							key={tab.id}
							tab={tab}
							index={index}
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
			<WorkspaceTabDivider isVisible={lastTab?.id !== activeTab.id} />
			<Button
				variant="ghost"
				size="icon-sm"
				className="shrink-0 text-muted-foreground hover:text-foreground"
				aria-label="Open new workspace tab"
				onClick={onCreateRootTab}
			>
				<Plus className="size-4" />
			</Button>
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

interface WorkspaceTabItemProps {
	tab: WorkspaceTab;
	index: number;
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
	const { isDragSource, isDropTarget } = useSortable({
		id: tab.id,
		index,
		element,
		handle: handleRef,
		type: WORKSPACE_TAB_DRAG_TYPE,
		transition: {
			duration: 160,
			easing: "cubic-bezier(0.2, 0, 0, 1)",
			idle: false,
		},
		data: {
			tabId: tab.id,
		},
	});
	const showAttachedChrome = isActive && !isDragSource;

	return (
		<div
			ref={setElement}
			className={cn(
				TAB_ITEM_CLASS,
				isDragSource && "opacity-70",
				isDropTarget && "rounded-md bg-muted/50",
			)}
		>
			{showDivider ? <WorkspaceTabDivider isVisible={showDividerLine} /> : null}
			<div
				className={cn(
					"group/tab flex min-w-0 flex-1 touch-none items-center border text-sm",
					showAttachedChrome
						? "workspace-tab-active h-8 text-foreground"
						: isActive
							? "h-8 rounded-md border-transparent bg-workspace-chrome-active text-foreground"
							: "h-8 rounded-md border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
					isDragSource && "cursor-grabbing",
				)}
			>
				<button
					ref={handleRef}
					type="button"
					className={cn(
						"flex h-full min-w-0 flex-1 touch-none items-center gap-1.5 py-0 pr-px pl-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
						isDragSource && "cursor-grabbing",
					)}
					onClick={onActivate}
				>
					<TabIcon
						className={cn("size-3.5 shrink-0", iconClassName)}
						strokeWidth={1.75}
						aria-hidden="true"
					/>
					<span className="truncate">{title}</span>
				</button>
				{showClose ? (
					<button
						type="button"
						className={cn(
							"mr-1 flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-muted hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-focus-within/tab:opacity-100 group-hover/tab:opacity-100",
							isActive && "opacity-100",
						)}
						aria-label={`Close ${title}`}
						onClick={onClose}
					>
						<X className="size-3" aria-hidden="true" />
					</button>
				) : null}
			</div>
		</div>
	);
}
