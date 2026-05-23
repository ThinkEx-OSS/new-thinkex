import type {
	WorkspaceColor,
	WorkspaceIcon,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";

export const DEFAULT_WORKSPACE_NAME = "Untitled Workspace";
export const DEFAULT_WORKSPACE_COLOR = "sky" satisfies WorkspaceColor;
export const DEFAULT_WORKSPACE_ICON = "compass" satisfies WorkspaceIcon;

export function createOptimisticWorkspace(
	id: WorkspaceSummary["id"] = crypto.randomUUID(),
): WorkspaceSummary {
	const now = new Date().toISOString();

	return {
		id,
		name: DEFAULT_WORKSPACE_NAME,
		description: null,
		icon: DEFAULT_WORKSPACE_ICON,
		color: DEFAULT_WORKSPACE_COLOR,
		createdAt: now,
		updatedAt: now,
		lastOpenedAt: now,
		archivedAt: null,
	};
}
