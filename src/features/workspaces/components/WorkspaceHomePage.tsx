import { useSuspenseQuery } from "@tanstack/react-query";
import { SearchX } from "lucide-react";
import { useState } from "react";

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
import CreateWorkspaceCard from "#/features/workspaces/components/CreateWorkspaceCard";
import WorkspaceCard from "#/features/workspaces/components/WorkspaceCard";
import { WorkspaceHomeSearchControl } from "#/features/workspaces/components/WorkspaceHomeSearchControl";
import {
	getWorkspaceRootTabSearch,
	getWorkspaceSessionTabSearch,
} from "#/features/workspaces/model/tabs";
import { workspacesQueryOptions } from "#/features/workspaces/query-options";
import { useWorkspacePersistedStoresHydrated } from "#/features/workspaces/state/persisted-store-hydration";
import { useWorkspaceTabsStore } from "#/features/workspaces/state/workspace-tabs-store";
import {
	createWorkspaceMutationInput,
	useCreateWorkspaceMutation,
} from "#/features/workspaces/use-create-workspace";

export function WorkspaceHomePage() {
	const { data: workspaces } = useSuspenseQuery(workspacesQueryOptions());
	const [query, setQuery] = useState("");
	const createWorkspaceMutation = useCreateWorkspaceMutation();
	const persistedStoresHydrated = useWorkspacePersistedStoresHydrated();
	const normalizedQuery = query.trim().toLowerCase();
	const filteredWorkspaces = workspaces.filter((workspace) => {
		return (
			normalizedQuery.length === 0 ||
			workspace.name.toLowerCase().includes(normalizedQuery)
		);
	});
	const hasSearch = query.trim().length > 0;

	return (
		<AppShell
			navbarControls={
				<WorkspaceHomeSearchControl
					value={query}
					onChange={setQuery}
					disabled={false}
				/>
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

function getWorkspaceCardSearch(
	workspaceId: string,
	persistedStoresHydrated: boolean,
) {
	if (!persistedStoresHydrated) {
		return getWorkspaceRootTabSearch();
	}

	const session = useWorkspaceTabsStore.getState().getSession(workspaceId);

	return getWorkspaceSessionTabSearch(session);
}
