import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import {
	useRecordWorkspaceOpenedMutation,
	WorkspacePageSkeleton,
	WorkspaceShell,
} from "#/features/workspaces";
import { seedWorkspaceCaches } from "#/features/workspaces/cache";
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
			throw notFound();
		}

		seedWorkspaceCaches(context.queryClient, page, {
			listMode: "update-existing",
		});
	},
	pendingComponent: WorkspacePageSkeleton,
	pendingMs: 0,
	pendingMinMs: 300,
	head: () => ({
		meta: [
			{
				title: "Thinkex | Workspace",
			},
		],
	}),
	component: WorkspacePage,
});

function WorkspacePage() {
	const { workspaceId } = Route.useParams();
	const { tab, view } = Route.useSearch();
	const recordedWorkspaceIds = useRef(new Set<string>());
	const recordWorkspaceOpenedMutation = useRecordWorkspaceOpenedMutation();
	const { data: page } = useSuspenseQuery(
		workspacePageQueryOptions(workspaceId),
	);

	useEffect(() => {
		if (recordedWorkspaceIds.current.has(workspaceId)) {
			return;
		}

		recordedWorkspaceIds.current.add(workspaceId);
		recordWorkspaceOpenedMutation.mutate({ workspaceId });
	}, [recordWorkspaceOpenedMutation, workspaceId]);

	if (!page) {
		throw notFound();
	}

	return (
		<WorkspaceShell
			workspace={page.workspace}
			items={page.items}
			activeTabIdFromUrl={tab}
			activeViewFromUrl={view}
		/>
	);
}
