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

export interface ReadWorkspaceKernelFileContentArgs {
	itemId: string;
}

export interface ReadWorkspaceKernelFileContentResult {
	bytes: Uint8Array;
	contentType: string;
	fileName: string;
	sizeBytes: number;
}

export type WorkspaceKernelFileProjectionFormat = "markdown";

export type WorkspaceKernelFileProjectionStatus =
	| "not_started"
	| "queued"
	| "processing"
	| "ready"
	| "failed"
	| "needs_review";

export interface UpsertWorkspaceKernelFileProjectionArgs {
	itemId: string;
	format: WorkspaceKernelFileProjectionFormat;
	status: WorkspaceKernelFileProjectionStatus;
	content?: string | null;
	provider?: string | null;
	providerMode?: string | null;
	errorMessage?: string | null;
	sourceHash?: string | null;
	metadataJson?: Record<string, JsonValue>;
	actorUserId?: string | null;
	clientMutationId?: string | null;
}

export interface ReadWorkspaceKernelFileProjectionArgs {
	itemId: string;
	format: WorkspaceKernelFileProjectionFormat;
}

export interface ReadWorkspaceKernelFileProjectionResult {
	itemId: string;
	format: WorkspaceKernelFileProjectionFormat;
	status: WorkspaceKernelFileProjectionStatus;
	content: string | null;
	provider: string | null;
	providerMode: string | null;
	errorMessage: string | null;
	sourceHash: string | null;
	metadataJson: Record<string, JsonValue>;
	updatedAt: string;
}

export interface WriteWorkspaceKernelItemArgs {
	itemId: string;
	content: string;
	actorUserId?: string | null;
	clientMutationId?: string | null;
}

export interface CreateWorkspaceKernelFileFromUploadArgs {
	parentId?: string | null;
	fileName: string;
	fileSize: number;
	objectKey: string;
	contentType?: string | null;
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
