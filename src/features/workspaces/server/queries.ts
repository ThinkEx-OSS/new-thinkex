import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { workspaceMembers, workspaces } from "#/db/schema";
import { createDbContext } from "#/db/server";
import type {
	WorkspaceDetail,
	WorkspacePage,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import { getWorkspaceKernelPage } from "#/features/workspaces/kernel/workspace-kernel-access";
import {
	mapWorkspaceDetailRow,
	mapWorkspaceRow,
} from "#/features/workspaces/server/mappers";
import { getCurrentUserId } from "#/features/workspaces/server/permissions";

type Db = Awaited<ReturnType<typeof createDbContext>>["db"];

export async function listWorkspacesForCurrentUser(): Promise<
	WorkspaceSummary[]
> {
	const userId = await getCurrentUserId();
	const dbContext = await createDbContext();

	try {
		return await listWorkspacesForUser(dbContext.db, userId);
	} finally {
		await dbContext.dispose();
	}
}

export async function listWorkspacesForUser(
	db: Db,
	userId: string,
): Promise<WorkspaceSummary[]> {
	const rows = await db
		.select({
			workspace: workspaces,
			lastOpenedAt: workspaceMembers.lastOpenedAt,
		})
		.from(workspaceMembers)
		.innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
		.where(
			and(eq(workspaceMembers.userId, userId), isNull(workspaces.archivedAt)),
		)
		.orderBy(
			desc(
				sql`coalesce(${workspaceMembers.lastOpenedAt}, ${workspaces.createdAt})`,
			),
			asc(workspaces.name),
		);

	return rows.map((row) =>
		mapWorkspaceRow({
			...row.workspace,
			lastOpenedAt: row.lastOpenedAt,
		}),
	);
}

export async function getWorkspaceForCurrentUser(
	workspaceId: string,
): Promise<WorkspaceDetail | null> {
	const userId = await getCurrentUserId();
	const dbContext = await createDbContext();

	try {
		const [row] = await dbContext.db
			.select({
				workspace: workspaces,
				lastOpenedAt: workspaceMembers.lastOpenedAt,
			})
			.from(workspaceMembers)
			.innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
			.where(
				and(
					eq(workspaceMembers.workspaceId, workspaceId),
					eq(workspaceMembers.userId, userId),
					isNull(workspaces.archivedAt),
				),
			)
			.limit(1);

		return row
			? mapWorkspaceDetailRow({
					...row.workspace,
					lastOpenedAt: row.lastOpenedAt,
				})
			: null;
	} finally {
		await dbContext.dispose();
	}
}

export async function getWorkspacePageForCurrentUser(
	workspaceId: string,
): Promise<WorkspacePage | null> {
	const userId = await getCurrentUserId();
	const dbContext = await createDbContext();

	try {
		const [workspaceRow] = await dbContext.db
			.select({
				workspace: workspaces,
				lastOpenedAt: workspaceMembers.lastOpenedAt,
			})
			.from(workspaceMembers)
			.innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
			.where(
				and(
					eq(workspaceMembers.workspaceId, workspaceId),
					eq(workspaceMembers.userId, userId),
					isNull(workspaces.archivedAt),
				),
			)
			.limit(1);

		if (!workspaceRow) {
			return null;
		}

		const workspace = mapWorkspaceDetailRow({
			...workspaceRow.workspace,
			lastOpenedAt: workspaceRow.lastOpenedAt,
		});

		return await getWorkspaceKernelPage({ workspaceId, userId, workspace });
	} finally {
		await dbContext.dispose();
	}
}
