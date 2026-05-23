import { relations, type SQL, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	customType,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
	dataType() {
		return "tsvector";
	},
});

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

export const workspaceItemType = pgEnum("workspace_item_type", [
	"folder",
	"document",
	"audio",
	"flashcard",
	"quiz",
	"pdf",
]);

export const workspaceIndexingPolicy = pgEnum("workspace_indexing_policy", [
	"default",
	"disabled",
]);

export const contentSnapshotKind = pgEnum("content_snapshot_kind", [
	"authored",
	"extracted",
	"generated",
]);

export const contentSnapshotFormat = pgEnum("content_snapshot_format", [
	"markdown",
	"plain_text",
	"transcript_json",
	"flashcard_json",
	"quiz_json",
]);

export const contentActorType = pgEnum("content_actor_type", [
	"user",
	"agent",
	"system",
]);

export const contentSnapshotReason = pgEnum("content_snapshot_reason", [
	"autosave",
	"ai_edit",
	"import",
	"restore",
	"ocr",
	"transcription",
	"manual",
]);

export const workspaceEventActorType = pgEnum("workspace_event_actor_type", [
	"user",
	"agent",
	"system",
]);

export const workspaceSearchIndexStatus = pgEnum(
	"workspace_search_index_status",
	["pending", "ready", "failed"],
);

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
	],
);

export const workspaceItems = pgTable(
	"workspace_items",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		parentId: text("parent_id").references(
			(): AnyPgColumn => workspaceItems.id,
			{ onDelete: "cascade" },
		),
		type: workspaceItemType("type").notNull(),
		name: text("name").notNull(),
		color: text("color"),
		sortOrder: integer("sort_order").default(0).notNull(),
		layoutJson: jsonb("layout_json").$type<Record<string, unknown>>(),
		metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
		indexingPolicy: workspaceIndexingPolicy("indexing_policy")
			.default("default")
			.notNull(),
		sourceVersion: integer("source_version").default(1).notNull(),
		contentHash: text("content_hash"),
		currentAuthoredSnapshotId: text("current_authored_snapshot_id"),
		currentExtractedSnapshotId: text("current_extracted_snapshot_id"),
		createdByUserId: text("created_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		updatedByUserId: text("updated_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		index("workspace_items_workspace_parent_idx").on(
			table.workspaceId,
			table.parentId,
		),
		index("workspace_items_workspace_type_idx").on(
			table.workspaceId,
			table.type,
		),
		index("workspace_items_parent_id_idx").on(table.parentId),
		index("workspace_items_deleted_at_idx").on(table.deletedAt),
		uniqueIndex("workspace_items_workspace_parent_name_unique")
			.on(table.workspaceId, sql`coalesce(${table.parentId}, '')`, table.name)
			.where(sql`${table.deletedAt} is null`),
	],
);

export const contentSnapshots = pgTable(
	"content_snapshots",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		itemId: text("item_id")
			.notNull()
			.references(() => workspaceItems.id, { onDelete: "cascade" }),
		kind: contentSnapshotKind("kind").notNull(),
		format: contentSnapshotFormat("format").notNull(),
		versionNumber: integer("version_number").notNull(),
		contentText: text("content_text"),
		contentJson: jsonb("content_json").$type<Record<string, unknown>>(),
		yjsStateRef: text("yjs_state_ref"),
		createdByType: contentActorType("created_by_type").notNull(),
		createdByUserId: text("created_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdByAgentSessionId: text("created_by_agent_session_id"),
		reason: contentSnapshotReason("reason").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("content_snapshots_item_kind_version_unique").on(
			table.itemId,
			table.kind,
			table.versionNumber,
		),
		index("content_snapshots_workspace_item_idx").on(
			table.workspaceId,
			table.itemId,
		),
		index("content_snapshots_item_kind_created_at_idx").on(
			table.itemId,
			table.kind,
			table.createdAt,
		),
	],
);

export const itemAssets = pgTable(
	"item_assets",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		itemId: text("item_id")
			.notNull()
			.references(() => workspaceItems.id, { onDelete: "cascade" }),
		r2Key: text("r2_key").notNull(),
		filename: text("filename").notNull(),
		mimeType: text("mime_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		checksum: text("checksum"),
		createdByUserId: text("created_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		replacedAt: timestamp("replaced_at"),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		index("item_assets_workspace_item_idx").on(table.workspaceId, table.itemId),
		index("item_assets_item_active_idx").on(
			table.itemId,
			table.replacedAt,
			table.deletedAt,
		),
		uniqueIndex("item_assets_r2_key_unique").on(table.r2Key),
	],
);

export const workspaceItemSearch = pgTable(
	"workspace_item_search",
	{
		itemId: text("item_id")
			.primaryKey()
			.references(() => workspaceItems.id, { onDelete: "cascade" }),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		nameText: text("name_text").notNull(),
		metadataText: text("metadata_text"),
		contentText: text("content_text"),
		extractedText: text("extracted_text"),
		searchVector: tsvector("search_vector")
			.notNull()
			.generatedAlwaysAs(
				(): SQL => sql`
					setweight(to_tsvector('english', coalesce(${workspaceItemSearch.nameText}, '')), 'A') ||
					setweight(to_tsvector('english', coalesce(${workspaceItemSearch.metadataText}, '')), 'B') ||
					setweight(to_tsvector('english', coalesce(${workspaceItemSearch.contentText}, '')), 'C') ||
					setweight(to_tsvector('english', coalesce(${workspaceItemSearch.extractedText}, '')), 'D')
				`,
			),
		currentAuthoredSnapshotId: text("current_authored_snapshot_id"),
		currentExtractedSnapshotId: text("current_extracted_snapshot_id"),
		status: workspaceSearchIndexStatus("status").default("pending").notNull(),
		indexError: text("index_error"),
		indexedAt: timestamp("indexed_at"),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("workspace_item_search_workspace_idx").on(table.workspaceId),
		index("workspace_item_search_status_idx").on(table.status),
		index("workspace_item_search_vector_idx").using("gin", table.searchVector),
	],
);

export const workspaceEvents = pgTable(
	"workspace_events",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
		itemId: text("item_id").references(() => workspaceItems.id, {
			onDelete: "set null",
		}),
		actorType: workspaceEventActorType("actor_type").notNull(),
		actorUserId: text("actor_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		actorAgentSessionId: text("actor_agent_session_id"),
		eventType: text("event_type").notNull(),
		payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("workspace_events_workspace_created_at_idx").on(
			table.workspaceId,
			table.createdAt,
		),
		index("workspace_events_item_created_at_idx").on(
			table.itemId,
			table.createdAt,
		),
	],
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	ownedWorkspaces: many(workspaces),
	workspaceMemberships: many(workspaceMembers),
	createdWorkspaceItems: many(workspaceItems, {
		relationName: "workspace_item_created_by_user",
	}),
	updatedWorkspaceItems: many(workspaceItems, {
		relationName: "workspace_item_updated_by_user",
	}),
	contentSnapshots: many(contentSnapshots),
	itemAssets: many(itemAssets),
	workspaceEvents: many(workspaceEvents),
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
	items: many(workspaceItems),
	contentSnapshots: many(contentSnapshots),
	assets: many(itemAssets),
	events: many(workspaceEvents),
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

export const workspaceItemRelations = relations(
	workspaceItems,
	({ one, many }) => ({
		workspace: one(workspaces, {
			fields: [workspaceItems.workspaceId],
			references: [workspaces.id],
		}),
		parent: one(workspaceItems, {
			fields: [workspaceItems.parentId],
			references: [workspaceItems.id],
			relationName: "workspace_item_parent",
		}),
		children: many(workspaceItems, {
			relationName: "workspace_item_parent",
		}),
		currentAuthoredSnapshot: one(contentSnapshots, {
			fields: [workspaceItems.currentAuthoredSnapshotId],
			references: [contentSnapshots.id],
			relationName: "workspace_item_current_authored_snapshot",
		}),
		currentExtractedSnapshot: one(contentSnapshots, {
			fields: [workspaceItems.currentExtractedSnapshotId],
			references: [contentSnapshots.id],
			relationName: "workspace_item_current_extracted_snapshot",
		}),
		createdByUser: one(user, {
			fields: [workspaceItems.createdByUserId],
			references: [user.id],
			relationName: "workspace_item_created_by_user",
		}),
		updatedByUser: one(user, {
			fields: [workspaceItems.updatedByUserId],
			references: [user.id],
			relationName: "workspace_item_updated_by_user",
		}),
		snapshots: many(contentSnapshots),
		assets: many(itemAssets),
		search: one(workspaceItemSearch),
		events: many(workspaceEvents),
	}),
);

export const contentSnapshotRelations = relations(
	contentSnapshots,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [contentSnapshots.workspaceId],
			references: [workspaces.id],
		}),
		item: one(workspaceItems, {
			fields: [contentSnapshots.itemId],
			references: [workspaceItems.id],
		}),
		createdByUser: one(user, {
			fields: [contentSnapshots.createdByUserId],
			references: [user.id],
		}),
	}),
);

export const itemAssetRelations = relations(itemAssets, ({ one }) => ({
	workspace: one(workspaces, {
		fields: [itemAssets.workspaceId],
		references: [workspaces.id],
	}),
	item: one(workspaceItems, {
		fields: [itemAssets.itemId],
		references: [workspaceItems.id],
	}),
	createdByUser: one(user, {
		fields: [itemAssets.createdByUserId],
		references: [user.id],
	}),
}));

export const workspaceItemSearchRelations = relations(
	workspaceItemSearch,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [workspaceItemSearch.workspaceId],
			references: [workspaces.id],
		}),
		item: one(workspaceItems, {
			fields: [workspaceItemSearch.itemId],
			references: [workspaceItems.id],
		}),
		currentAuthoredSnapshot: one(contentSnapshots, {
			fields: [workspaceItemSearch.currentAuthoredSnapshotId],
			references: [contentSnapshots.id],
			relationName: "workspace_search_current_authored_snapshot",
		}),
		currentExtractedSnapshot: one(contentSnapshots, {
			fields: [workspaceItemSearch.currentExtractedSnapshotId],
			references: [contentSnapshots.id],
			relationName: "workspace_search_current_extracted_snapshot",
		}),
	}),
);

export const workspaceEventRelations = relations(
	workspaceEvents,
	({ one }) => ({
		workspace: one(workspaces, {
			fields: [workspaceEvents.workspaceId],
			references: [workspaces.id],
		}),
		item: one(workspaceItems, {
			fields: [workspaceEvents.itemId],
			references: [workspaceItems.id],
		}),
		actorUser: one(user, {
			fields: [workspaceEvents.actorUserId],
			references: [user.id],
		}),
	}),
);
