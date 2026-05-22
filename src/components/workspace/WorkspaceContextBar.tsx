import {
	ChevronRight,
	Download,
	Ellipsis,
	FilePlus2,
	FileText,
	FolderPlus,
	HelpCircle,
	Layers3,
	Search,
	Upload,
	X,
} from "lucide-react";

import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import type { WorkspaceItem } from "#/components/workspace/types";
import type { WorkspaceSummary } from "#/lib/api/contracts";
import type { WorkspaceTab } from "#/stores/workspace-tabs";

const newItemActions = [
	{
		label: "Folder",
		icon: FolderPlus,
	},
	{
		label: "Document",
		icon: FileText,
	},
	{
		label: "Flashcard deck",
		icon: Layers3,
	},
	{
		label: "Quiz",
		icon: HelpCircle,
	},
	{
		label: "PDF upload",
		icon: Upload,
	},
];

interface WorkspaceContextBarProps {
	workspace: WorkspaceSummary;
	activeTab: WorkspaceTab;
	activeItem?: WorkspaceItem;
	onCloseItem: () => void;
}

export default function WorkspaceContextBar({
	workspace,
	activeTab,
	activeItem,
	onCloseItem,
}: WorkspaceContextBarProps) {
	const isItemView = activeTab.kind === "item";
	const currentLabel = isItemView
		? (activeItem?.title ?? activeTab.title)
		: "Workspace";

	return (
		<div className="flex h-11 items-center justify-between gap-3 border-b border-border/70 bg-muted/30 px-4 text-sm">
			<nav
				className="flex min-w-0 items-center gap-1.5 text-muted-foreground"
				aria-label="Workspace context"
			>
				<span className="truncate">{workspace.name}</span>
				<ChevronRight className="size-3 shrink-0" aria-hidden="true" />
				<span className="truncate font-medium text-foreground">
					{currentLabel}
				</span>
			</nav>

			<div className="flex shrink-0 items-center gap-1">
				{isItemView ? (
					<>
						<Button
							variant="ghost"
							size="sm"
							type="button"
							className="h-8 gap-1.5 px-2.5 text-sm text-muted-foreground hover:text-foreground"
						>
							<Download className="size-3.5" />
							<span className="hidden sm:inline">Export</span>
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							type="button"
							className="size-8.5 text-muted-foreground hover:text-foreground"
							aria-label="More item actions"
						>
							<Ellipsis className="size-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							type="button"
							className="size-8.5 text-muted-foreground hover:text-foreground"
							aria-label="Close item"
							onClick={onCloseItem}
						>
							<X className="size-4" />
						</Button>
					</>
				) : (
					<>
						<Button
							variant="ghost"
							size="sm"
							type="button"
							className="h-8 gap-1.5 px-2.5 text-sm text-muted-foreground hover:text-foreground"
						>
							<Search className="size-3.5" />
							<span className="hidden sm:inline">Search</span>
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									type="button"
									className="h-8 gap-1.5 px-2.5 text-sm text-muted-foreground hover:text-foreground"
								>
									<FilePlus2 className="size-3.5" />
									<span className="hidden sm:inline">New</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								{newItemActions.map(({ label, icon: Icon }) => (
									<DropdownMenuItem key={label}>
										<Icon className="size-4 text-muted-foreground" />
										<span>{label}</span>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				)}
			</div>
		</div>
	);
}
