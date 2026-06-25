import { createFileRoute } from "@tanstack/react-router";

import AppNotFoundScreen from "#/components/AppNotFoundScreen";
import WorkspacePageRoute from "#/features/workspaces/components/WorkspacePageRoute";
import { workspacePageQueryOptions } from "#/features/workspaces/query-options";

export const Route = createFileRoute("/_protected/workspaces/$workspaceId")({
	validateSearch: (search) => ({
		tab: typeof search.tab === "string" ? search.tab : undefined,
		view: typeof search.view === "string" ? search.view : undefined,
	}),
	loader: ({ context, params }) => {
		void context.queryClient.prefetchQuery(workspacePageQueryOptions(params.workspaceId));
	},
	notFoundComponent: AppNotFoundScreen,
	head: () => ({
		meta: [
			{
				title: "Thinkex | Workspace",
			},
		],
	}),
	component: WorkspacePageRoute,
});
