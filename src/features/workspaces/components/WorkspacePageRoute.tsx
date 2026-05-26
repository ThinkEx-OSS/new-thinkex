import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, notFound } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { workspacePageQueryOptions } from "#/features/workspaces/query-options";
import { useRecordWorkspaceOpenedMutation } from "#/features/workspaces/use-record-workspace-opened";
import { WorkspaceShell } from "./WorkspaceLayout";

const routeApi = getRouteApi("/_protected/workspaces/$workspaceId");

export default function WorkspacePageRoute() {
	const { workspaceId } = routeApi.useParams();
	const { tab, view } = routeApi.useSearch({
		select: (search) => ({
			tab: search.tab,
			view: search.view,
		}),
		structuralSharing: true,
	});
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
			activeTabIdFromUrl={tab}
			activeViewFromUrl={view}
			items={page.items}
			revision={page.revision}
			workspace={page.workspace}
		/>
	);
}
