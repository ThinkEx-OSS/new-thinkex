import { createFileRoute, notFound } from "@tanstack/react-router";

import {
	listMockWorkspaceItems,
	listMockWorkspaces,
	WorkspaceShell,
} from "#/features/workspaces";

export const Route = createFileRoute("/_protected/workspaces/$workspaceId")({
	validateSearch: (search) => ({
		tab: typeof search.tab === "string" ? search.tab : undefined,
		view: typeof search.view === "string" ? search.view : undefined,
	}),
	beforeLoad: async ({ params }) => {
		const workspaces = listMockWorkspaces();
		const workspace = workspaces.find((item) => item.id === params.workspaceId);

		if (!workspace) {
			throw notFound();
		}

		return {
			workspace,
		};
	},
	head: ({ match }) => ({
		meta: [
			{
				title: `Thinkex | ${match.context.workspace.name}`,
			},
		],
	}),
	component: WorkspacePage,
});

function WorkspacePage() {
	const { workspace } = Route.useRouteContext();
	const { tab, view } = Route.useSearch();
	const workspaceItems = listMockWorkspaceItems(workspace.id);

	return (
		<WorkspaceShell
			workspace={workspace}
			items={workspaceItems}
			activeTabIdFromUrl={tab}
			activeViewFromUrl={view}
		/>
	);
}
