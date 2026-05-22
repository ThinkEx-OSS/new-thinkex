import { createFileRoute, notFound } from "@tanstack/react-router";
import {
	BookOpen,
	ChartNoAxesColumn,
	FileText,
	FolderOpen,
	HelpCircle,
	Layers3,
	MessageSquare,
	Paperclip,
	Presentation,
	Sparkles,
} from "lucide-react";

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
	{
		id: "bibliography",
		title: "Bibliography",
		meta: "32 citations",
		icon: BookOpen,
	},
	{
		id: "quote-bank",
		title: "Quote Bank",
		meta: "18 excerpts",
		icon: FileText,
	},
	{
		id: "data-snapshots",
		title: "Data Snapshots",
		meta: "5 charts",
		icon: ChartNoAxesColumn,
	},
	{
		id: "attachments",
		title: "Attachments",
		meta: "11 uploads",
		icon: Paperclip,
	},
	{
		id: "presentation",
		title: "Presentation",
		meta: "14 slides",
		icon: Presentation,
	},
	{
		id: "topic-map",
		title: "Topic Map",
		meta: "9 clusters",
		icon: Layers3,
	},
	{
		id: "ai-digests",
		title: "AI Digests",
		meta: "3 summaries",
		icon: Sparkles,
	},
	{
		id: "archive",
		title: "Archive",
		meta: "17 saved items",
		icon: FolderOpen,
	},
	{
		id: "practice-quiz",
		title: "Practice Quiz",
		meta: "20 questions",
		icon: HelpCircle,
	},
	{
		id: "meeting-notes",
		title: "Meeting Notes",
		meta: "Updated yesterday",
		icon: MessageSquare,
	},
	{
		id: "final-draft",
		title: "Final Draft",
		meta: "Ready for review",
		icon: FileText,
	},
	{
		id: "reading-queue",
		title: "Reading Queue",
		meta: "13 unread",
		icon: BookOpen,
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
