import { and, eq } from "drizzle-orm";

import {
	user,
	workspaceInvites,
	workspaceMembers,
	workspaces,
} from "#/db/schema";
import type { createDbContext } from "#/db/server";
import type { WorkspaceRole } from "#/features/workspaces/invites/workspace-invite-rules";
import {
	createInviteToken,
	getDefaultInviteLinkExpiresAt,
	isInviteExpired,
	resolveRoleAfterAccept,
} from "#/features/workspaces/invites/workspace-invite-rules";
import { assertCanGrantWorkspaceRole } from "#/features/workspaces/server/permissions";
import { buildInvitePath } from "#/lib/client-url";

type Db = Awaited<ReturnType<typeof createDbContext>>["db"];

export class WorkspaceInviteError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "WorkspaceInviteError";
	}
}

export interface WorkspaceInvitePreview {
	expiresAt: Date | null;
	inviterName: string;
	role: WorkspaceRole;
	workspaceId: string;
	workspaceName: string;
}

async function getPendingWorkspaceInviteByToken(db: Db, token: string) {
	const [row] = await db
		.select({
			expiresAt: workspaceInvites.expiresAt,
			id: workspaceInvites.id,
			inviterName: user.name,
			role: workspaceInvites.role,
			status: workspaceInvites.status,
			type: workspaceInvites.type,
			workspaceId: workspaces.id,
			workspaceName: workspaces.name,
		})
		.from(workspaceInvites)
		.innerJoin(workspaces, eq(workspaceInvites.workspaceId, workspaces.id))
		.innerJoin(user, eq(workspaceInvites.createdByUserId, user.id))
		.where(eq(workspaceInvites.token, token))
		.limit(1);

	if (row?.status !== "pending") {
		throw new WorkspaceInviteError("Invite not found.");
	}

	if (isInviteExpired(row.expiresAt)) {
		throw new WorkspaceInviteError("Invite expired.");
	}

	return row;
}

export async function getWorkspaceInvitePreview(
	db: Db,
	token: string,
): Promise<WorkspaceInvitePreview> {
	const invite = await getPendingWorkspaceInviteByToken(db, token);

	return {
		expiresAt: invite.expiresAt,
		inviterName: invite.inviterName,
		role: invite.role,
		workspaceId: invite.workspaceId,
		workspaceName: invite.workspaceName,
	};
}

export async function acceptWorkspaceInvite(
	db: Db,
	input: { token: string; userId: string },
) {
	// v1: the token is a secret link — any signed-in user may accept; no invitee email check.
	const invite = await getPendingWorkspaceInviteByToken(db, input.token);

	return db.transaction(async (tx) => {
		const [existingMembership] = await tx
			.select({
				id: workspaceMembers.id,
				role: workspaceMembers.role,
			})
			.from(workspaceMembers)
			.where(
				and(
					eq(workspaceMembers.workspaceId, invite.workspaceId),
					eq(workspaceMembers.userId, input.userId),
				),
			)
			.limit(1);

		const resolvedRole = existingMembership
			? resolveRoleAfterAccept(existingMembership.role, invite.role)
			: invite.role;

		if (existingMembership) {
			if (resolvedRole !== existingMembership.role) {
				await tx
					.update(workspaceMembers)
					.set({ role: resolvedRole })
					.where(eq(workspaceMembers.id, existingMembership.id));
			}
		} else {
			await tx.insert(workspaceMembers).values({
				id: crypto.randomUUID(),
				workspaceId: invite.workspaceId,
				userId: input.userId,
				role: resolvedRole,
			});
		}

		// Email invites are single-use (link invites stay pending/multi-use) so the row
		// leaves the Invited list and the same address can be re-invited later.
		if (invite.type === "email") {
			await tx
				.update(workspaceInvites)
				.set({ status: "accepted" })
				.where(eq(workspaceInvites.id, invite.id));
		}

		return {
			role: resolvedRole,
			workspaceId: invite.workspaceId,
		};
	});
}

export async function getOrCreateWorkspaceInviteLink(
	db: Db,
	input: {
		workspaceId: string;
		userId: string;
		role: WorkspaceRole;
	},
) {
	await assertCanGrantWorkspaceRole(db, input);

	const [existingInvite] = await db
		.select({
			expiresAt: workspaceInvites.expiresAt,
			token: workspaceInvites.token,
		})
		.from(workspaceInvites)
		.where(
			and(
				eq(workspaceInvites.workspaceId, input.workspaceId),
				eq(workspaceInvites.role, input.role),
				eq(workspaceInvites.type, "link"),
				eq(workspaceInvites.status, "pending"),
			),
		)
		.limit(1);

	if (existingInvite?.token && !isInviteExpired(existingInvite.expiresAt)) {
		return {
			expiresAt: existingInvite.expiresAt,
			path: buildInvitePath(existingInvite.token),
		};
	}

	if (existingInvite?.token) {
		await db
			.update(workspaceInvites)
			.set({ status: "expired" })
			.where(
				and(
					eq(workspaceInvites.workspaceId, input.workspaceId),
					eq(workspaceInvites.role, input.role),
					eq(workspaceInvites.type, "link"),
					eq(workspaceInvites.status, "pending"),
				),
			);
	}

	const token = createInviteToken();
	const expiresAt = getDefaultInviteLinkExpiresAt();

	await db.insert(workspaceInvites).values({
		id: crypto.randomUUID(),
		workspaceId: input.workspaceId,
		role: input.role,
		type: "link",
		status: "pending",
		token,
		createdByUserId: input.userId,
		expiresAt,
	});

	return {
		expiresAt,
		path: buildInvitePath(token),
	};
}
