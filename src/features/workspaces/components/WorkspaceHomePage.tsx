import { useSuspenseQuery } from "@tanstack/react-query";

import AppShell from "#/components/AppShell";
import SiteFooter from "#/components/SiteFooter";
import CreateWorkspaceCard from "#/features/workspaces/components/CreateWorkspaceCard";
import WorkspaceCard from "#/features/workspaces/components/WorkspaceCard";
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
	const createWorkspaceMutation = useCreateWorkspaceMutation();
	const persistedStoresHydrated = useWorkspacePersistedStoresHydrated();

	return (
		<AppShell>
			{/*
			 * Reserve the available viewport (100vh minus the 3rem header and
			 * main's 1.5rem padding, plus ~9rem so the footer logo peeks a
			 * teaser at the fold) for the grid so the footer flows just below it.
			 */}
			<div className="min-h-[calc(100vh-13.5rem)] space-y-4">
				<section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
					<CreateWorkspaceCard
						disabled={createWorkspaceMutation.isPending}
						onCreate={() =>
							createWorkspaceMutation.mutate(createWorkspaceMutationInput())
						}
					/>
					{workspaces.map((workspace) => (
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
			</div>
			<SiteFooter />
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
