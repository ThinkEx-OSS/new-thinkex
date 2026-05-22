import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ListFilter, Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import AppShell from "#/components/AppShell";
import CreateWorkspaceCard from "#/components/CreateWorkspaceCard";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { Input } from "#/components/ui/input";
import WorkspaceCard from "#/components/WorkspaceCard";
import type { WorkspaceSummary } from "#/lib/api/contracts";
import {
	getWorkspaceTabSearch,
	WORKSPACE_ROOT_VIEW,
} from "#/lib/workspace-tabs";
import { listMockWorkspaces } from "#/services/workspaces";
import { useWorkspaceTabsStore } from "#/stores/workspace-tabs";

type WorkspaceStatusFilter = "all" | WorkspaceSummary["status"];

export const Route = createFileRoute("/_protected/home")({
	beforeLoad: async () => {
		return {
			workspaces: listMockWorkspaces(),
		};
	},
	head: () => ({
		meta: [
			{
				title: "Thinkex | Home",
			},
		],
	}),
	component: HomePage,
});

function HomePage() {
	const { workspaces } = Route.useRouteContext();
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [statusFilter, setStatusFilter] =
		useState<WorkspaceStatusFilter>("all");

	const filteredWorkspaces = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		return workspaces.filter((workspace) => {
			const matchesQuery =
				normalizedQuery.length === 0 ||
				workspace.name.toLowerCase().includes(normalizedQuery);
			const matchesStatus =
				statusFilter === "all" || workspace.status === statusFilter;

			return matchesQuery && matchesStatus;
		});
	}, [query, statusFilter, workspaces]);
	const hasActiveFilters = query.trim().length > 0 || statusFilter !== "all";

	const navbarControls = (
		<>
			<div className="relative min-w-0 flex-1">
				<Search
					className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search workspaces"
					className="h-8 pl-8"
					aria-label="Search workspaces"
				/>
			</div>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
					>
						<ListFilter className="size-3.5" />
						<span className="hidden sm:inline">Filter</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-40">
					<DropdownMenuLabel>Status</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuRadioGroup
						value={statusFilter}
						onValueChange={(value) =>
							setStatusFilter(value as WorkspaceStatusFilter)
						}
					>
						<DropdownMenuRadioItem value="all">
							All workspaces
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="ready">Ready</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="draft">Draft</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);

	return (
		<AppShell navbarControls={navbarControls}>
			<div className="space-y-4">
				<section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
					<CreateWorkspaceCard />
					{filteredWorkspaces.map((workspace) => (
						<WorkspaceCard
							key={workspace.id}
							workspace={workspace}
							onSelect={() => {
								const session = useWorkspaceTabsStore
									.getState()
									.getSession(workspace.id);
								const activeTab = session?.tabs.find(
									(tab) => tab.id === session.activeTabId,
								);

								navigate({
									to: "/workspaces/$workspaceId",
									params: { workspaceId: workspace.id },
									search: activeTab
										? getWorkspaceTabSearch(activeTab)
										: { tab: undefined, view: WORKSPACE_ROOT_VIEW },
								});
							}}
						/>
					))}
				</section>
				{filteredWorkspaces.length === 0 ? (
					<Empty className="border border-dashed bg-muted/20">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<SearchX />
							</EmptyMedia>
							<EmptyTitle>
								{hasActiveFilters
									? "No matching workspaces"
									: "No workspaces yet"}
							</EmptyTitle>
							<EmptyDescription>
								{hasActiveFilters
									? "Try a different search or clear the current filters."
									: "Create a workspace to start organizing your research."}
							</EmptyDescription>
						</EmptyHeader>
						{hasActiveFilters ? (
							<EmptyContent>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => {
										setQuery("");
										setStatusFilter("all");
									}}
								>
									Clear filters
								</Button>
							</EmptyContent>
						) : null}
					</Empty>
				) : null}
			</div>
		</AppShell>
	);
}
