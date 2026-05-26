import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, eq, isNull } from "drizzle-orm";

import { workspaceMembers, workspaces } from "#/db/schema";
import type { createDbContext } from "#/db/server";
import { getSessionFromHeaders } from "#/lib/auth-queries.server";

type Db = Awaited<ReturnType<typeof createDbContext>>["db"];

export class WorkspaceAuthError extends Error {
	constructor() {
		super("Unauthorized");
		this.name = "WorkspaceAuthError";
	}
}

export class WorkspaceForbiddenError extends Error {
	constructor() {
		super("Forbidden");
		this.name = "WorkspaceForbiddenError";
	}
}

export async function getCurrentUserId() {
	const session = await getSessionFromHeaders(getRequestHeaders());
	const userId = session?.user.id;

	if (!userId) {
		throw new WorkspaceAuthError();
	}

	return userId;
}

export async function canReadWorkspace(
	db: Db,
	input: { workspaceId: string; userId: string },
) {
	const [membership] = await db
		.select({ id: workspaceMembers.id })
		.from(workspaceMembers)
		.innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
		.where(
			and(
				eq(workspaceMembers.workspaceId, input.workspaceId),
				eq(workspaceMembers.userId, input.userId),
				isNull(workspaces.archivedAt),
			),
		)
		.limit(1);

	return Boolean(membership);
}

export async function assertCanReadWorkspace(
	db: Db,
	input: { workspaceId: string; userId: string },
) {
	if (!(await canReadWorkspace(db, input))) {
		throw new WorkspaceForbiddenError();
	}
}

export async function assertCanMutateWorkspace(
	db: Db,
	input: { workspaceId: string; userId: string },
) {
	const [membership] = await db
		.select({ role: workspaceMembers.role })
		.from(workspaceMembers)
		.innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
		.where(
			and(
				eq(workspaceMembers.workspaceId, input.workspaceId),
				eq(workspaceMembers.userId, input.userId),
				isNull(workspaces.archivedAt),
			),
		)
		.limit(1);

	if (!membership || membership.role === "viewer") {
		throw new WorkspaceForbiddenError();
	}
}

export async function assertCanDeleteWorkspace(
	db: Db,
	input: { workspaceId: string; userId: string },
) {
	const [membership] = await db
		.select({ role: workspaceMembers.role })
		.from(workspaceMembers)
		.innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
		.where(
			and(
				eq(workspaceMembers.workspaceId, input.workspaceId),
				eq(workspaceMembers.userId, input.userId),
				isNull(workspaces.archivedAt),
			),
		)
		.limit(1);

	if (membership?.role !== "owner") {
		throw new WorkspaceForbiddenError();
	}
}
