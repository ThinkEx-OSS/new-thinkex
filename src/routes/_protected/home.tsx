import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ListFilter, Search } from "lucide-react";
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
import { Input } from "#/components/ui/input";
import WorkspaceCard from "#/components/WorkspaceCard";
import type { WorkspaceSummary } from "#/lib/api/contracts";
import { getWorkspaceTabSearch } from "#/lib/workspace-tabs";
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

	return (
		<AppShell>
			<div className="space-y-4">
				<div className="flex flex-wrap items-center justify-end gap-2">
					<div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
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
							<Button variant="outline" size="sm" className="h-8 gap-1.5">
								<ListFilter className="size-3.5" />
								Filter
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
								<DropdownMenuRadioItem value="ready">
									Ready
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem value="draft">
									Draft
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

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
										: { tab: undefined, view: undefined },
								});
							}}
						/>
					))}
				</section>
			</div>
		</AppShell>
	);
}
