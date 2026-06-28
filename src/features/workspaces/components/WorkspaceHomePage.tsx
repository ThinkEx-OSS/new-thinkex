import { useSuspenseQuery } from "@tanstack/react-query";

import AppShell from "#/components/AppShell";
import CreateWorkspaceCard from "#/features/workspaces/components/CreateWorkspaceCard";
import MissingWorkspacesCard from "#/features/workspaces/components/MissingWorkspacesCard";
import WorkspaceCard from "#/features/workspaces/components/WorkspaceCard";
import {
	getWorkspaceRootTabSearch,
	getWorkspaceSessionTabSearch,
} from "#/features/workspaces/model/tabs";
import { workspacesQueryOptions } from "#/features/workspaces/query-options";
import { useWorkspacePersistedStoresHydrated } from "#/features/workspaces/state/persisted-store-hydration";
import { useWorkspaceTabsStore } from "#/features/workspaces/state/workspace-tabs-store";
import { useCreateWorkspaceMutation } from "#/features/workspaces/use-create-workspace";

export function WorkspaceHomePage() {
	const { data: workspaces } = useSuspenseQuery(workspacesQueryOptions());
	const createWorkspaceMutation = useCreateWorkspaceMutation();
	const persistedStoresHydrated = useWorkspacePersistedStoresHydrated();

	return (
		<AppShell>
			<div className="space-y-4">
				<section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
					<CreateWorkspaceCard
						onCreate={() => createWorkspaceMutation.mutate()}
						pending={createWorkspaceMutation.isPending}
					/>
					{workspaces.length === 0 ? <MissingWorkspacesCard /> : null}
					{workspaces.map((workspace) => (
						<WorkspaceCard
							key={workspace.id}
							workspace={workspace}
							search={getWorkspaceCardSearch(workspace.id, persistedStoresHydrated)}
						/>
					))}
				</section>
			</div>
		</AppShell>
	);
}

function getWorkspaceCardSearch(workspaceId: string, persistedStoresHydrated: boolean) {
	if (!persistedStoresHydrated) {
		return getWorkspaceRootTabSearch();
	}

	const session = useWorkspaceTabsStore.getState().getSession(workspaceId);

	return getWorkspaceSessionTabSearch(session);
}
