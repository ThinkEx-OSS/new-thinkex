import { createFileRoute, notFound } from "@tanstack/react-router";
import { BookOpen, FileText, MessageSquare } from "lucide-react";

import {
	type WorkspaceItem,
	WorkspaceShell,
} from "#/components/workspace/WorkspaceLayout";
import { listMockWorkspaces } from "#/services/workspaces";

const workspaceItems: WorkspaceItem[] = [
	{
		id: "research-notes",
		title: "Research Notes",
		meta: "12 items",
		icon: FileText,
	},
	{
		id: "reading-list",
		title: "Reading List",
		meta: "8 sources",
		icon: BookOpen,
	},
	{
		id: "draft-outline",
		title: "Draft Outline",
		meta: "Updated today",
		icon: MessageSquare,
	},
	{
		id: "source-pack",
		title: "Source Pack",
		meta: "24 files",
		icon: FileText,
	},
	{
		id: "study-plan",
		title: "Study Plan",
		meta: "4 sections",
		icon: BookOpen,
	},
	{
		id: "open-questions",
		title: "Open Questions",
		meta: "6 prompts",
		icon: MessageSquare,
	},
];

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

	return (
		<WorkspaceShell
			workspace={workspace}
			items={workspaceItems}
			activeTabIdFromUrl={tab}
			activeViewFromUrl={view}
		/>
	);
}
