import { and, asc, eq, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";

import {
	user,
	workspaceInvites,
	workspaceMembers,
	workspaces,
} from "#/db/schema";
import type { createDbContext } from "#/db/server";
import type { WorkspaceEmailInviteSummary } from "#/features/workspaces/contracts";
import type { WorkspaceRole } from "#/features/workspaces/invites/workspace-invite-rules";
import {
	canGrantRole,
	getDefaultInviteLinkExpiresAt,
	isInviteExpired,
	isValidInviteEmail,
	normalizeInviteEmail,
	resolveRoleAfterAccept,
} from "#/features/workspaces/invites/workspace-invite-rules";
import {
	assertCanReadWorkspace,
	getWorkspaceMemberRole,
	WorkspaceForbiddenError,
} from "#/features/workspaces/server/permissions";

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

function createInviteToken() {
	return crypto.randomUUID().replaceAll("-", "");
}

async function assertCanGrantWorkspaceRole(
	db: Db,
	input: { workspaceId: string; userId: string; role: WorkspaceRole },
) {
	await assertCanReadWorkspace(db, input);
	const memberRole = await getWorkspaceMemberRole(db, input);

	if (!memberRole || !canGrantRole(memberRole, input.role)) {
		throw new WorkspaceForbiddenError();
	}

	return memberRole;
}

function getInvitePath(token: string) {
	return `/invite/${token}`;
}

export async function getWorkspaceInvitePreview(db: Db, token: string) {
	const [row] = await db
		.select({
			expiresAt: workspaceInvites.expiresAt,
			inviterName: user.name,
			role: workspaceInvites.role,
			status: workspaceInvites.status,
			workspaceId: workspaces.id,
			workspaceName: workspaces.name,
		})
		.from(workspaceInvites)
		.innerJoin(workspaces, eq(workspaceInvites.workspaceId, workspaces.id))
		.innerJoin(user, eq(workspaceInvites.createdByUserId, user.id))
		.where(eq(workspaceInvites.token, token))
		.limit(1);

	if (!row || row.status !== "pending") {
		throw new WorkspaceInviteError("Invite not found.");
	}

	if (isInviteExpired(row.expiresAt)) {
		throw new WorkspaceInviteError("Invite expired.");
	}

	return {
		expiresAt: row.expiresAt,
		inviterName: row.inviterName,
		role: row.role,
		workspaceId: row.workspaceId,
		workspaceName: row.workspaceName,
	} satisfies WorkspaceInvitePreview;
}

export async function acceptWorkspaceInvite(
	db: Db,
	input: { token: string; userId: string },
) {
	const preview = await getWorkspaceInvitePreview(db, input.token);

	return db.transaction(async (tx) => {
		const [existingMembership] = await tx
			.select({
				id: workspaceMembers.id,
				role: workspaceMembers.role,
			})
			.from(workspaceMembers)
			.where(
				and(
					eq(workspaceMembers.workspaceId, preview.workspaceId),
					eq(workspaceMembers.userId, input.userId),
				),
			)
			.limit(1);

		const resolvedRole = existingMembership
			? resolveRoleAfterAccept(existingMembership.role, preview.role)
			: preview.role;

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
				workspaceId: preview.workspaceId,
				userId: input.userId,
				role: resolvedRole,
			});
		}

		return {
			role: resolvedRole,
			workspaceId: preview.workspaceId,
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
			path: getInvitePath(existingInvite.token),
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
		path: getInvitePath(token),
	};
}

export async function listWorkspaceEmailInvites(
	db: Db,
	input: { workspaceId: string; userId: string },
): Promise<WorkspaceEmailInviteSummary[]> {
	await assertCanReadWorkspace(db, input);

	const now = new Date();

	const rows = await db
		.select({
			id: workspaceInvites.id,
			email: workspaceInvites.email,
			role: workspaceInvites.role,
			createdAt: workspaceInvites.createdAt,
		})
		.from(workspaceInvites)
		.where(
			and(
				eq(workspaceInvites.workspaceId, input.workspaceId),
				eq(workspaceInvites.type, "email"),
				eq(workspaceInvites.status, "pending"),
				isNotNull(workspaceInvites.email),
				or(
					isNull(workspaceInvites.expiresAt),
					gt(workspaceInvites.expiresAt, now),
				),
			),
		)
		.orderBy(asc(workspaceInvites.createdAt));

	return rows.flatMap((row) => {
		if (row.email === null) {
			return [];
		}

		return [
			{
				id: row.id,
				email: row.email,
				role: row.role,
				createdAt: row.createdAt,
			},
		];
	});
}

export interface CreateWorkspaceEmailInvitesResult {
	invited: string[];
	skipped: Array<{
		email: string;
		reason: "already_member" | "invalid_email";
	}>;
}

export async function createWorkspaceEmailInvites(
	db: Db,
	input: {
		workspaceId: string;
		userId: string;
		role: WorkspaceRole;
		emails: string[];
	},
): Promise<CreateWorkspaceEmailInvitesResult> {
	await assertCanGrantWorkspaceRole(db, input);

	const invited: string[] = [];
	const skipped: CreateWorkspaceEmailInvitesResult["skipped"] = [];
	const uniqueEmails = [
		...new Set(input.emails.map((email) => normalizeInviteEmail(email))),
	];

	if (uniqueEmails.length === 0) {
		return { invited, skipped };
	}

	const validEmails = uniqueEmails.filter((email) => {
		if (!isValidInviteEmail(email)) {
			skipped.push({ email, reason: "invalid_email" });
			return false;
		}

		return true;
	});

	if (validEmails.length === 0) {
		return { invited, skipped };
	}

	const existingMembers = await db
		.select({ email: user.email })
		.from(workspaceMembers)
		.innerJoin(user, eq(workspaceMembers.userId, user.id))
		.where(eq(workspaceMembers.workspaceId, input.workspaceId));

	const memberEmails = new Set(
		existingMembers.map((row) => normalizeInviteEmail(row.email)),
	);

	const emailsToInvite = validEmails.filter((email) => {
		if (memberEmails.has(email)) {
			skipped.push({ email, reason: "already_member" });
			return false;
		}

		return true;
	});

	if (emailsToInvite.length === 0) {
		return { invited, skipped };
	}

	const existingInvites = await db
		.select({
			id: workspaceInvites.id,
			email: workspaceInvites.email,
		})
		.from(workspaceInvites)
		.where(
			and(
				eq(workspaceInvites.workspaceId, input.workspaceId),
				eq(workspaceInvites.type, "email"),
				eq(workspaceInvites.status, "pending"),
				inArray(workspaceInvites.email, emailsToInvite),
			),
		);

	const existingInviteByEmail = new Map(
		existingInvites.flatMap((row) =>
			row.email ? [[normalizeInviteEmail(row.email), row.id] as const] : [],
		),
	);

	const expiresAt = getDefaultInviteLinkExpiresAt();

	for (const email of emailsToInvite) {
		const existingInviteId = existingInviteByEmail.get(email);

		if (existingInviteId) {
			await db
				.update(workspaceInvites)
				.set({
					role: input.role,
					createdByUserId: input.userId,
					expiresAt,
				})
				.where(eq(workspaceInvites.id, existingInviteId));
		} else {
			await db.insert(workspaceInvites).values({
				id: crypto.randomUUID(),
				workspaceId: input.workspaceId,
				role: input.role,
				type: "email",
				status: "pending",
				email,
				createdByUserId: input.userId,
				expiresAt,
			});
		}

		invited.push(email);
	}

	return { invited, skipped };
}

export async function cancelWorkspaceEmailInvite(
	db: Db,
	input: {
		workspaceId: string;
		userId: string;
		inviteId: string;
	},
) {
	await assertCanReadWorkspace(db, input);
	const memberRole = await getWorkspaceMemberRole(db, input);

	const [invite] = await db
		.select({
			id: workspaceInvites.id,
			role: workspaceInvites.role,
		})
		.from(workspaceInvites)
		.where(
			and(
				eq(workspaceInvites.id, input.inviteId),
				eq(workspaceInvites.workspaceId, input.workspaceId),
				eq(workspaceInvites.type, "email"),
				eq(workspaceInvites.status, "pending"),
			),
		)
		.limit(1);

	if (!invite) {
		throw new WorkspaceInviteError("Invite not found.");
	}

	if (!memberRole || !canGrantRole(memberRole, invite.role)) {
		throw new WorkspaceForbiddenError();
	}

	await db
		.update(workspaceInvites)
		.set({ status: "revoked" })
		.where(eq(workspaceInvites.id, invite.id));
}
