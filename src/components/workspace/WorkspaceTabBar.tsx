import { FileQuestion, Plus, X } from "lucide-react";

import { Button } from "#/components/ui/button";
import type { WorkspaceItem } from "#/components/workspace/types";
import type { WorkspaceSummary } from "#/lib/api/contracts";
import { cn } from "#/lib/utils";
import { getWorkspaceDisplay } from "#/lib/workspace-display";
import { findItemForTab } from "#/lib/workspace-tabs";
import type { WorkspaceTab } from "#/stores/workspace-tabs";

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
			className="flex min-w-0 items-center gap-1"
			aria-label="Workspace tabs"
		>
			<div className="flex min-w-0 items-center gap-1 overflow-hidden">
				{tabs.map((tab) => {
					const isActive = tab.id === activeTab.id;
					const item = findItemForTab(tab, itemsById);
					const TabIcon =
						tab.kind === "root" ? Icon : (item?.icon ?? FileQuestion);

					return (
						<div
							key={tab.id}
							className={cn(
								"flex h-8 min-w-0 max-w-48 items-center rounded-md border text-sm transition-colors",
								isActive
									? "border-border bg-muted text-foreground"
									: "border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground",
							)}
						>
							<button
								type="button"
								className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onClick={() => onActivateTab(tab)}
							>
								<TabIcon
									className={cn(
										"size-3.5 shrink-0",
										tab.kind === "root" ? accent.text : "text-muted-foreground",
									)}
									strokeWidth={1.75}
									aria-hidden="true"
								/>
								<span className="truncate">{tab.title}</span>
							</button>
							{tabs.length > 1 ? (
								<button
									type="button"
									className="mr-1 rounded-sm p-0.5 text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
									aria-label={`Close ${tab.title}`}
									onClick={() => onCloseTab(tab)}
								>
									<X className="size-3" aria-hidden="true" />
								</button>
							) : null}
						</div>
					);
				})}
			</div>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="Open new workspace tab"
				onClick={onCreateRootTab}
			>
				<Plus className="size-4" />
			</Button>
		</nav>
	);
}
