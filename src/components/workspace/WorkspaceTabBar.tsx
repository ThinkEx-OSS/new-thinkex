import { FileQuestion, type LucideIcon, Plus, X } from "lucide-react";

import { Button } from "#/components/ui/button";
import type { WorkspaceItem } from "#/components/workspace/types";
import type { WorkspaceSummary } from "#/lib/api/contracts";
import { cn } from "#/lib/utils";
import { getWorkspaceDisplay } from "#/lib/workspace-display";
import { getWorkspaceItemDisplay } from "#/lib/workspace-item-display";
import { findItemForTab } from "#/lib/workspace-tabs";
import type { WorkspaceTab } from "#/stores/workspace-tabs";

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
	const { Icon, accent } = getWorkspaceDisplay(workspace);

	return (
		<nav
			className="flex min-w-0 flex-1 items-center gap-1"
			aria-label="Workspace tabs"
		>
			<div
				className="grid min-w-0 max-w-full items-center gap-1 overflow-hidden"
				style={{
					gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
					width: "100%",
					maxWidth: `calc(${tabs.length} * ${TAB_MAX_WIDTH})`,
				}}
			>
				{tabs.map((tab, index) => {
					const item = findItemForTab(tab, itemsById);
					const isRootTab = !tab.viewItemId;
					const TabIcon = isRootTab ? Icon : (item?.icon ?? FileQuestion);
					const title = item?.name ?? (isRootTab ? workspace.name : tab.title);
					const iconClassName = isRootTab
						? accent.text
						: item
							? getWorkspaceItemDisplay(item).iconClassName
							: "text-muted-foreground";

					return (
						<WorkspaceTabItem
							key={tab.id}
							tab={tab}
							title={title}
							TabIcon={TabIcon}
							iconClassName={iconClassName}
							isActive={tab.id === activeTab.id}
							showDivider={index > 0}
							showClose={tabs.length > 1}
							onActivate={() => onActivateTab(tab)}
							onClose={() => onCloseTab(tab)}
						/>
					);
				})}
			</div>
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

interface WorkspaceTabItemProps {
	tab: WorkspaceTab;
	title: string;
	TabIcon: LucideIcon;
	iconClassName?: string;
	isActive: boolean;
	showDivider: boolean;
	showClose: boolean;
	onActivate: () => void;
	onClose: () => void;
}

function WorkspaceTabItem({
	title,
	TabIcon,
	iconClassName,
	isActive,
	showDivider,
	showClose,
	onActivate,
	onClose,
}: WorkspaceTabItemProps) {
	return (
		<div className={TAB_ITEM_CLASS}>
			{showDivider ? (
				<div className="h-4 w-px shrink-0 bg-border/70" aria-hidden="true" />
			) : null}
			<div
				className={cn(
					"group/tab flex h-7 min-w-0 flex-1 items-center rounded-md border text-sm",
					isActive
						? "border-transparent bg-muted/30 text-foreground"
						: "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
				)}
			>
				<button
					type="button"
					className="flex h-full min-w-0 flex-1 items-center gap-1.5 py-0 pr-px pl-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
