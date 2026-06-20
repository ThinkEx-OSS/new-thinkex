import { createFileRoute, notFound } from "@tanstack/react-router";

import AppNotFoundScreen from "#/components/AppNotFoundScreen";
import { seedWorkspaceCaches } from "#/features/workspaces/cache";
import WorkspacePageRoute from "#/features/workspaces/components/WorkspacePageRoute";
import WorkspaceShellSkeleton from "#/features/workspaces/components/WorkspaceShellSkeleton";
import { workspacePageQueryOptions } from "#/features/workspaces/query-options";

export const Route = createFileRoute("/_protected/workspaces/$workspaceId")({
	validateSearch: (search) => ({
		tab: typeof search.tab === "string" ? search.tab : undefined,
		view: typeof search.view === "string" ? search.view : undefined,
	}),
	loader: async ({ context, params }) => {
		const page = await context.queryClient.ensureQueryData(
			workspacePageQueryOptions(params.workspaceId),
		);

		if (!page) {
			throw notFound({ data: { resource: "workspace" } });
		}

		seedWorkspaceCaches(
			context.queryClient,
			{
				workspace: page.workspace,
				items: page.items,
				revision: page.revision,
			},
			{ listMode: "update-existing" },
		);
	},
	staleTime: 10_000,
	notFoundComponent: AppNotFoundScreen,
	pendingComponent: WorkspaceShellSkeleton,
	pendingMs: 300,
	pendingMinMs: 200,
	head: () => ({
		meta: [
			{
				title: "Thinkex | Workspace",
			},
		],
	}),
	component: WorkspacePageRoute,
});
