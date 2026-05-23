import { and, eq, isNull } from "drizzle-orm";

import { workspaceEvents, workspaceMembers, workspaces } from "#/db/schema";
import { createDbContext } from "#/db/server";
import type {
	CreateWorkspaceInput,
	DeleteWorkspaceInput,
	UpdateWorkspaceInput,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import {
	DEFAULT_WORKSPACE_COLOR,
	DEFAULT_WORKSPACE_ICON,
	DEFAULT_WORKSPACE_NAME,
} from "#/features/workspaces/defaults";
import { mapWorkspaceRow } from "#/features/workspaces/server/mappers";
import {
	assertCanDeleteWorkspace,
	assertCanMutateWorkspace,
	assertCanReadWorkspace,
	getCurrentUserId,
} from "#/features/workspaces/server/permissions";

export async function createWorkspaceForCurrentUser(
	input: CreateWorkspaceInput,
): Promise<WorkspaceSummary> {
	const userId = await getCurrentUserId();
	const dbContext = await createDbContext();
	const workspaceId = input.id ?? crypto.randomUUID();
	const openedAt = new Date();

	try {
		const row = await dbContext.db.transaction(async (tx) => {
			const [workspace] = await tx
				.insert(workspaces)
				.values({
					id: workspaceId,
					name: input.name?.trim() || DEFAULT_WORKSPACE_NAME,
					color: input.color ?? DEFAULT_WORKSPACE_COLOR,
					icon: DEFAULT_WORKSPACE_ICON,
					ownerId: userId,
				})
				.returning();

			if (!workspace) {
				throw new Error("Workspace was not created.");
			}

			await tx.insert(workspaceMembers).values({
				id: crypto.randomUUID(),
				workspaceId: workspace.id,
				userId,
				role: "owner",
				lastOpenedAt: openedAt,
			});

			await tx.insert(workspaceEvents).values({
				id: crypto.randomUUID(),
				workspaceId: workspace.id,
				actorType: "user",
				actorUserId: userId,
				eventType: "workspace.created",
				payloadJson: {
					name: workspace.name,
					icon: workspace.icon,
					color: workspace.color,
				},
			});

			return workspace;
		});

		return mapWorkspaceRow({
			...row,
			lastOpenedAt: openedAt,
		});
	} finally {
		await dbContext.dispose();
	}
}

export async function recordWorkspaceOpenedForCurrentUser(
	workspaceId: string,
): Promise<WorkspaceSummary | null> {
	const userId = await getCurrentUserId();
	const dbContext = await createDbContext();
	const openedAt = new Date();

	try {
		await assertCanReadWorkspace(dbContext.db, { workspaceId, userId });

		const [membership] = await dbContext.db
			.update(workspaceMembers)
			.set({ lastOpenedAt: openedAt })
			.where(
				and(
					eq(workspaceMembers.workspaceId, workspaceId),
					eq(workspaceMembers.userId, userId),
				),
			)
			.returning({ lastOpenedAt: workspaceMembers.lastOpenedAt });

		const [workspace] = await dbContext.db
			.select()
			.from(workspaces)
			.where(and(eq(workspaces.id, workspaceId), isNull(workspaces.archivedAt)))
			.limit(1);

		if (!membership || !workspace) {
			return null;
		}

		return mapWorkspaceRow({
			...workspace,
			lastOpenedAt: membership.lastOpenedAt,
		});
	} finally {
		await dbContext.dispose();
	}
}

export async function updateWorkspaceForCurrentUser(
	input: UpdateWorkspaceInput,
): Promise<WorkspaceSummary> {
	const userId = await getCurrentUserId();
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, {
			workspaceId: input.workspaceId,
			userId,
		});

		const workspace = await dbContext.db.transaction(async (tx) => {
			const [updatedWorkspace] = await tx
				.update(workspaces)
				.set({
					name: input.name,
					icon: input.icon,
					color: input.color,
				})
				.where(
					and(
						eq(workspaces.id, input.workspaceId),
						isNull(workspaces.archivedAt),
					),
				)
				.returning();

			if (!updatedWorkspace) {
				throw new Error("Workspace was not updated.");
			}

			await tx.insert(workspaceEvents).values({
				id: crypto.randomUUID(),
				workspaceId: updatedWorkspace.id,
				actorType: "user",
				actorUserId: userId,
				eventType: "workspace.updated",
				payloadJson: {
					name: updatedWorkspace.name,
					icon: updatedWorkspace.icon,
					color: updatedWorkspace.color,
				},
			});

			const [membership] = await tx
				.select({ lastOpenedAt: workspaceMembers.lastOpenedAt })
				.from(workspaceMembers)
				.where(
					and(
						eq(workspaceMembers.workspaceId, input.workspaceId),
						eq(workspaceMembers.userId, userId),
					),
				)
				.limit(1);

			return {
				...updatedWorkspace,
				lastOpenedAt: membership?.lastOpenedAt ?? null,
			};
		});

		return mapWorkspaceRow(workspace);
	} finally {
		await dbContext.dispose();
	}
}

export async function deleteWorkspaceForCurrentUser(
	input: DeleteWorkspaceInput,
) {
	const userId = await getCurrentUserId();
	const dbContext = await createDbContext();

	try {
		await assertCanDeleteWorkspace(dbContext.db, {
			workspaceId: input.workspaceId,
			userId,
		});

		const [workspace] = await dbContext.db
			.select()
			.from(workspaces)
			.where(
				and(
					eq(workspaces.id, input.workspaceId),
					isNull(workspaces.archivedAt),
				),
			)
			.limit(1);

		if (!workspace) {
			return null;
		}

		if (workspace.name !== input.confirmationName.trim()) {
			throw new Error("Workspace name confirmation does not match.");
		}

		const [deletedWorkspace] = await dbContext.db
			.delete(workspaces)
			.where(eq(workspaces.id, input.workspaceId))
			.returning({ id: workspaces.id });

		return deletedWorkspace ?? null;
	} finally {
		await dbContext.dispose();
	}
}

export async function archiveWorkspaceForCurrentUser(workspaceId: string) {
	const userId = await getCurrentUserId();
	const dbContext = await createDbContext();

	try {
		await assertCanMutateWorkspace(dbContext.db, { workspaceId, userId });

		const workspace = await dbContext.db.transaction(async (tx) => {
			const [archivedWorkspace] = await tx
				.update(workspaces)
				.set({ archivedAt: new Date() })
				.where(eq(workspaces.id, workspaceId))
				.returning();

			if (!archivedWorkspace) {
				return null;
			}

			await tx.insert(workspaceEvents).values({
				id: crypto.randomUUID(),
				workspaceId: archivedWorkspace.id,
				actorType: "user",
				actorUserId: userId,
				eventType: "workspace.archived",
				payloadJson: {
					name: archivedWorkspace.name,
				},
			});

			return archivedWorkspace;
		});

		return workspace ? mapWorkspaceRow(workspace) : null;
	} finally {
		await dbContext.dispose();
	}
}
