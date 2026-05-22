import {
	type WorkspaceSummary,
	workspaceListResponseSchema,
} from "#/lib/api/contracts";

const MOCK_WORKSPACES: WorkspaceSummary[] = [
	{
		id: "workspace-research-atlas",
		name: "Research Atlas",
		icon: "compass",
		accent: "sky",
		updatedAt: "Updated 2 hours ago",
		status: "ready",
	},
	{
		id: "workspace-thesis-lab",
		name: "Thesis Lab",
		icon: "flask-conical",
		accent: "violet",
		updatedAt: "Updated yesterday",
		status: "draft",
	},
	{
		id: "workspace-exam-sprint",
		name: "Exam Sprint",
		icon: "zap",
		accent: "amber",
		updatedAt: "Updated 3 days ago",
		status: "draft",
	},
	{
		id: "workspace-reading-queue",
		name: "Reading Queue",
		icon: "book-marked",
		accent: "emerald",
		updatedAt: "Updated 5 days ago",
		status: "ready",
	},
];

export function listMockWorkspaces() {
	return workspaceListResponseSchema.parse({
		workspaces: MOCK_WORKSPACES,
	}).workspaces;
}
