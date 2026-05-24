import type {
	WorkspaceColor,
	WorkspaceIcon,
	WorkspaceItemType,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";

export const DEFAULT_WORKSPACE_NAME = "Untitled Workspace";
export const DEFAULT_WORKSPACE_COLOR = "sky" satisfies WorkspaceColor;
export const DEFAULT_WORKSPACE_ICON = "compass" satisfies WorkspaceIcon;

export function getDefaultWorkspaceItemName(type: WorkspaceItemType) {
	switch (type) {
		case "folder":
			return "Untitled Folder";
		case "document":
			return "Untitled Document";
		case "audio":
			return "Untitled Audio";
		case "flashcard":
			return "Untitled Flashcards";
		case "quiz":
			return "Untitled Quiz";
		case "pdf":
			return "Untitled PDF";
	}
}

export function getAvailableWorkspaceItemName(input: {
	type: WorkspaceItemType;
	existingNames: Iterable<string>;
	requestedName?: string;
}) {
	const baseName =
		input.requestedName?.trim() || getDefaultWorkspaceItemName(input.type);
	const existingNames = new Set(input.existingNames);

	if (!existingNames.has(baseName)) {
		return baseName;
	}

	for (let suffix = 2; suffix < 1000; suffix += 1) {
		const candidate = `${baseName} ${suffix}`;

		if (!existingNames.has(candidate)) {
			return candidate;
		}
	}

	return `${baseName} ${crypto.randomUUID().slice(0, 8)}`;
}

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
