import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
	createWorkspaceInputSchema,
	createWorkspaceItemInputSchema,
	deleteWorkspaceInputSchema,
	updateWorkspaceInputSchema,
} from "#/features/workspaces/contracts";
import { createWorkspaceItemForCurrentUser } from "#/features/workspaces/server/item-mutations";
import {
	createWorkspaceForCurrentUser,
	deleteWorkspaceForCurrentUser,
	recordWorkspaceOpenedForCurrentUser,
	updateWorkspaceForCurrentUser,
} from "#/features/workspaces/server/mutations";
import {
	getWorkspaceForCurrentUser,
	getWorkspacePageForCurrentUser,
	listWorkspaceItemsForCurrentUser,
	listWorkspacesForCurrentUser,
} from "#/features/workspaces/server/queries";

const workspaceIdInputSchema = z.object({
	workspaceId: z.string().min(1),
});

export const listWorkspacesFn = createServerFn({ method: "GET" }).handler(
	async () => listWorkspacesForCurrentUser(),
);

export const getWorkspaceFn = createServerFn({ method: "GET" })
	.inputValidator(workspaceIdInputSchema)
	.handler(async ({ data }) => getWorkspaceForCurrentUser(data.workspaceId));

export const listWorkspaceItemsFn = createServerFn({ method: "GET" })
	.inputValidator(workspaceIdInputSchema)
	.handler(async ({ data }) =>
		listWorkspaceItemsForCurrentUser(data.workspaceId),
	);

export const getWorkspacePageFn = createServerFn({ method: "GET" })
	.inputValidator(workspaceIdInputSchema)
	.handler(async ({ data }) =>
		getWorkspacePageForCurrentUser(data.workspaceId),
	);

export const createWorkspaceFn = createServerFn({ method: "POST" })
	.inputValidator(createWorkspaceInputSchema)
	.handler(async ({ data }) => createWorkspaceForCurrentUser(data));

export const createWorkspaceItemFn = createServerFn({ method: "POST" })
	.inputValidator(createWorkspaceItemInputSchema)
	.handler(async ({ data }) => createWorkspaceItemForCurrentUser(data));

export const recordWorkspaceOpenedFn = createServerFn({ method: "POST" })
	.inputValidator(workspaceIdInputSchema)
	.handler(async ({ data }) =>
		recordWorkspaceOpenedForCurrentUser(data.workspaceId),
	);

export const updateWorkspaceFn = createServerFn({ method: "POST" })
	.inputValidator(updateWorkspaceInputSchema)
	.handler(async ({ data }) => updateWorkspaceForCurrentUser(data));

export const deleteWorkspaceFn = createServerFn({ method: "POST" })
	.inputValidator(deleteWorkspaceInputSchema)
	.handler(async ({ data }) => deleteWorkspaceForCurrentUser(data));
