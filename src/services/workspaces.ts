import {
	type WorkspaceSummary,
	workspaceListResponseSchema,
} from "#/lib/api/contracts";

const MOCK_WORKSPACES: WorkspaceSummary[] = [
	{
		id: "workspace-research-atlas",
		name: "Research Atlas",
		description: "Gather sources, compare claims, and build a study outline.",
		updatedAt: "Updated 2 hours ago",
		status: "ready",
	},
	{
		id: "workspace-thesis-lab",
		name: "Thesis Lab",
		description: "Track notes, citations, and writing tasks in one place.",
		updatedAt: "Updated yesterday",
		status: "draft",
	},
	{
		id: "workspace-exam-sprint",
		name: "Exam Sprint",
		description:
			"Turn scattered reading into a revision checklist and quizzes.",
		updatedAt: "Updated 3 days ago",
		status: "draft",
	},
];

export function listMockWorkspaces() {
	return workspaceListResponseSchema.parse({
		workspaces: MOCK_WORKSPACES,
	}).workspaces;
}
