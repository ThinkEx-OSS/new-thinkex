import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import AppShell from "#/components/AppShell";
import { Button } from "#/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { Input } from "#/components/ui/input";
import CreateWorkspaceCard from "#/features/workspaces/components/CreateWorkspaceCard";
import WorkspaceCard from "#/features/workspaces/components/WorkspaceCard";
import WorkspaceCardSkeleton from "#/features/workspaces/components/WorkspaceCardSkeleton";
import {
	getWorkspaceTabSearch,
	WORKSPACE_ROOT_VIEW,
} from "#/features/workspaces/model/tabs";
import { workspacesQueryOptions } from "#/features/workspaces/query-options";
import { useWorkspacePersistedStoresHydrated } from "#/features/workspaces/state/persisted-store-hydration";
import { useWorkspaceTabsStore } from "#/features/workspaces/state/workspace-tabs-store";
import {
	createWorkspaceMutationInput,
	useCreateWorkspaceMutation,
} from "#/features/workspaces/use-create-workspace";

export const Route = createFileRoute("/_protected/home")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(workspacesQueryOptions());
	},
	pendingComponent: HomePageSkeleton,
	pendingMs: 0,
	pendingMinMs: 300,
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
	const { data: workspaces } = useSuspenseQuery(workspacesQueryOptions());
	const [query, setQuery] = useState("");
	const createWorkspaceMutation = useCreateWorkspaceMutation();
	const persistedStoresHydrated = useWorkspacePersistedStoresHydrated();

	const filteredWorkspaces = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		return workspaces.filter((workspace) => {
			return (
				normalizedQuery.length === 0 ||
				workspace.name.toLowerCase().includes(normalizedQuery)
			);
		});
	}, [query, workspaces]);
	const hasSearch = query.trim().length > 0;

	return (
		<AppShell
			navbarControls={
				<HomeSearchControl value={query} onChange={setQuery} disabled={false} />
			}
		>
			<div className="space-y-4">
				<section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
					<CreateWorkspaceCard
						disabled={createWorkspaceMutation.isPending}
						onCreate={() =>
							createWorkspaceMutation.mutate(createWorkspaceMutationInput())
						}
					/>
					{filteredWorkspaces.map((workspace) => (
						<WorkspaceCard
							key={workspace.id}
							workspace={workspace}
							search={getWorkspaceCardSearch(
								workspace.id,
								persistedStoresHydrated,
							)}
						/>
					))}
				</section>
				{hasSearch && filteredWorkspaces.length === 0 ? (
					<Empty className="border border-dashed bg-muted/20">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<SearchX />
							</EmptyMedia>
							<EmptyTitle>No matching workspaces</EmptyTitle>
							<EmptyDescription>Try a different search.</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setQuery("")}
							>
								Clear search
							</Button>
						</EmptyContent>
					</Empty>
				) : null}
			</div>
		</AppShell>
	);
}

function HomePageSkeleton() {
	return (
		<AppShell
			navbarControls={
				<HomeSearchControl value="" onChange={() => {}} disabled={true} />
			}
		>
			<div className="space-y-4">
				<section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
					<CreateWorkspaceCard disabled={true} />
					{homeWorkspaceSkeletonCardIds.map((id) => (
						<WorkspaceCardSkeleton key={id} />
					))}
				</section>
			</div>
		</AppShell>
	);
}

function HomeSearchControl({
	value,
	onChange,
	disabled,
}: {
	value: string;
	onChange: (value: string) => void;
	disabled: boolean;
}) {
	return (
		<div className="relative min-w-0 flex-1">
			<Search
				className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<Input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder="Search workspaces"
				className="h-8 pl-8"
				aria-label="Search workspaces"
				disabled={disabled}
			/>
		</div>
	);
}

const homeWorkspaceSkeletonCardIds = ["recent", "research", "notes"] as const;


function getWorkspaceCardSearch(
	workspaceId: string,
	persistedStoresHydrated: boolean,
) {
	if (!persistedStoresHydrated) {
		return { tab: undefined, view: WORKSPACE_ROOT_VIEW };
	}

	const session = useWorkspaceTabsStore.getState().getSession(workspaceId);
	const activeTab = session?.tabs.find((tab) => tab.id === session.activeTabId);

	return activeTab
		? getWorkspaceTabSearch(activeTab)
		: { tab: undefined, view: WORKSPACE_ROOT_VIEW };
}
