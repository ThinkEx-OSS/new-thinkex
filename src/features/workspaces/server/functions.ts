import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
	createWorkspaceInputSchema,
	createWorkspaceItemInputSchema,
	deleteWorkspaceInputSchema,
	deleteWorkspaceItemInputSchema,
	moveWorkspaceItemInputSchema,
	readWorkspaceItemInputSchema,
	renameWorkspaceItemInputSchema,
	updateWorkspaceInputSchema,
	writeWorkspaceItemInputSchema,
} from "#/features/workspaces/contracts";
import {
	createWorkspaceKernelItem,
	deleteWorkspaceKernelItem,
	moveWorkspaceKernelItem,
	readWorkspaceKernelItem,
	renameWorkspaceKernelItem,
	writeWorkspaceKernelItem,
} from "#/features/workspaces/kernel/workspace-kernel-access";
import {
	createWorkspaceForCurrentUser,
	deleteWorkspaceForCurrentUser,
	recordWorkspaceOpenedForCurrentUser,
	updateWorkspaceForCurrentUser,
} from "#/features/workspaces/server/mutations";
import { getCurrentUserId } from "#/features/workspaces/server/permissions";
import {
	getWorkspaceForCurrentUser,
	getWorkspacePageForCurrentUser,
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

export const getWorkspacePageFn = createServerFn({ method: "GET" })
	.inputValidator(workspaceIdInputSchema)
	.handler(async ({ data }) =>
		getWorkspacePageForCurrentUser(data.workspaceId),
	);

export const createWorkspaceFn = createServerFn({ method: "POST" })
	.inputValidator(createWorkspaceInputSchema)
	.handler(async ({ data }) => createWorkspaceForCurrentUser(data));

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

export const createWorkspaceItemFn = createServerFn({ method: "POST" })
	.inputValidator(createWorkspaceItemInputSchema)
	.handler(async ({ data }) =>
		createWorkspaceKernelItem({
			...data,
			userId: await getCurrentUserId(),
		}),
	);

export const readWorkspaceItemFn = createServerFn({ method: "GET" })
	.inputValidator(readWorkspaceItemInputSchema)
	.handler(async ({ data }) =>
		readWorkspaceKernelItem({
			...data,
			userId: await getCurrentUserId(),
		}),
	);

export const renameWorkspaceItemFn = createServerFn({ method: "POST" })
	.inputValidator(renameWorkspaceItemInputSchema)
	.handler(async ({ data }) =>
		renameWorkspaceKernelItem({
			...data,
			userId: await getCurrentUserId(),
		}),
	);

export const moveWorkspaceItemFn = createServerFn({ method: "POST" })
	.inputValidator(moveWorkspaceItemInputSchema)
	.handler(async ({ data }) =>
		moveWorkspaceKernelItem({
			...data,
			userId: await getCurrentUserId(),
		}),
	);

export const deleteWorkspaceItemFn = createServerFn({ method: "POST" })
	.inputValidator(deleteWorkspaceItemInputSchema)
	.handler(async ({ data }) =>
		deleteWorkspaceKernelItem({
			...data,
			userId: await getCurrentUserId(),
		}),
	);

export const writeWorkspaceItemFn = createServerFn({ method: "POST" })
	.inputValidator(writeWorkspaceItemInputSchema)
	.handler(async ({ data }) =>
		writeWorkspaceKernelItem({
			...data,
			userId: await getCurrentUserId(),
		}),
	);
