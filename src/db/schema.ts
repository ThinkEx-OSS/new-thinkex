import { relations, sql } from "drizzle-orm";
import {
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const workspaceRole = pgEnum("workspace_role", [
	"owner",
	"admin",
	"editor",
	"viewer",
]);

export const workspaceInviteType = pgEnum("workspace_invite_type", [
	"email",
	"link",
]);

export const workspaceInviteStatus = pgEnum("workspace_invite_status", [
	"pending",
	"accepted",
	"revoked",
	"expired",
]);

export const workspaces = pgTable(
	"workspaces",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		icon: text("icon"),
		color: text("color"),
		description: text("description"),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		archivedAt: timestamp("archived_at"),
	},
	(table) => [
		index("workspaces_owner_id_idx").on(table.ownerId),
		index("workspaces_archived_at_idx").on(table.archivedAt),
	],
);

export const workspaceMembers = pgTable(
	"workspace_members",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: workspaceRole("role").default("viewer").notNull(),
		lastOpenedAt: timestamp("last_opened_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("workspace_members_workspace_user_unique").on(
			table.workspaceId,
			table.userId,
		),
		index("workspace_members_user_id_idx").on(table.userId),
		index("workspace_members_user_last_opened_at_idx").on(
			table.userId,
			table.lastOpenedAt,
		),
	],
);

export const workspaceInvites = pgTable(
	"workspace_invites",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		role: workspaceRole("role").notNull(),
		type: workspaceInviteType("type").notNull(),
		status: workspaceInviteStatus("status").default("pending").notNull(),
		email: text("email"),
		token: text("token"),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("workspace_invites_token_unique").on(table.token),
		uniqueIndex("workspace_invites_pending_link_per_role")
			.on(table.workspaceId, table.role)
			.where(sql`${table.type} = 'link' and ${table.status} = 'pending'`),
		uniqueIndex("workspace_invites_pending_email_per_workspace")
			.on(table.workspaceId, table.email)
			.where(sql`${table.type} = 'email' and ${table.status} = 'pending'`),
		index("workspace_invites_workspace_id_idx").on(table.workspaceId),
		index("workspace_invites_created_by_user_id_idx").on(table.createdByUserId),
	],
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	ownedWorkspaces: many(workspaces),
	workspaceMemberships: many(workspaceMembers),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));

export const workspaceRelations = relations(workspaces, ({ one, many }) => ({
	owner: one(user, {
		fields: [workspaces.ownerId],
		references: [user.id],
	}),
	members: many(workspaceMembers),
	invites: many(workspaceInvites),
}));

export const workspaceMemberRelations = relations(
	workspaceMembers,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [workspaceMembers.workspaceId],
			references: [workspaces.id],
		}),
		user: one(user, {
			fields: [workspaceMembers.userId],
			references: [user.id],
		}),
	}),
);

export const workspaceInviteRelations = relations(
	workspaceInvites,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [workspaceInvites.workspaceId],
			references: [workspaces.id],
		}),
		createdBy: one(user, {
			fields: [workspaceInvites.createdByUserId],
			references: [user.id],
		}),
	}),
);
