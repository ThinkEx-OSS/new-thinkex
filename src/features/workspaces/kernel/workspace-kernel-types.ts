import type {
	JsonValue,
	WorkspaceItemSummary,
	WorkspaceItemType,
} from "#/features/workspaces/contracts";

export interface WorkspaceKernelPage {
	workspaceId: string;
	items: WorkspaceItemSummary[];
	revision: number;
}

export interface ListWorkspaceKernelItemsArgs {
	parentId?: string | null;
	limit?: number;
}

export interface CreateWorkspaceKernelItemArgs {
	id?: string;
	parentId?: string | null;
	type: WorkspaceItemType;
	name?: string;
	color?: string | null;
	metadataJson?: Record<string, JsonValue>;
	initialContent?: string;
	actorUserId?: string | null;
	clientMutationId?: string | null;
}

export interface RenameWorkspaceKernelItemArgs {
	itemId: string;
	name: string;
	actorUserId?: string | null;
	clientMutationId?: string | null;
}

export interface MoveWorkspaceKernelItemArgs {
	itemId: string;
	parentId?: string | null;
	sortOrder?: number;
	actorUserId?: string | null;
	clientMutationId?: string | null;
}

export interface DeleteWorkspaceKernelItemArgs {
	itemId: string;
	actorUserId?: string | null;
	clientMutationId?: string | null;
}

export interface ReadWorkspaceKernelItemArgs {
	itemId: string;
}

export interface WriteWorkspaceKernelItemArgs {
	itemId: string;
	content: string;
	actorUserId?: string | null;
	clientMutationId?: string | null;
}

export interface DeleteWorkspaceKernelItemResult {
	id: string;
	deletedItemIds: string[];
}

export interface ListWorkspaceKernelEventsArgs {
	afterRevision: number;
	limit?: number;
}
