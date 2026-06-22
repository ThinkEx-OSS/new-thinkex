PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workspace_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`role` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`email` text,
	`token` text,
	`created_by_user_id` text NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "workspace_invites_role_check" CHECK("__new_workspace_invites"."role" in ('owner', 'admin', 'editor', 'viewer')),
	CONSTRAINT "workspace_invites_type_check" CHECK("__new_workspace_invites"."type" in ('email', 'link')),
	CONSTRAINT "workspace_invites_status_check" CHECK("__new_workspace_invites"."status" in ('pending', 'accepted', 'revoked', 'expired'))
);
--> statement-breakpoint
INSERT INTO `__new_workspace_invites`("id", "workspace_id", "role", "type", "status", "email", "token", "created_by_user_id", "expires_at", "created_at", "updated_at") SELECT "id", "workspace_id", "role", "type", "status", "email", "token", "created_by_user_id", "expires_at", "created_at", "updated_at" FROM `workspace_invites`;--> statement-breakpoint
DROP TABLE `workspace_invites`;--> statement-breakpoint
ALTER TABLE `__new_workspace_invites` RENAME TO `workspace_invites`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invites_token_unique` ON `workspace_invites` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invites_pending_link_per_role` ON `workspace_invites` (`workspace_id`,`role`) WHERE "workspace_invites"."type" = 'link' and "workspace_invites"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invites_pending_email_per_workspace` ON `workspace_invites` (`workspace_id`,`email`) WHERE "workspace_invites"."type" = 'email' and "workspace_invites"."status" = 'pending';--> statement-breakpoint
CREATE INDEX `workspace_invites_workspace_id_idx` ON `workspace_invites` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_invites_created_by_user_id_idx` ON `workspace_invites` (`created_by_user_id`);--> statement-breakpoint
CREATE TABLE `__new_workspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`last_opened_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "workspace_members_role_check" CHECK("__new_workspace_members"."role" in ('owner', 'admin', 'editor', 'viewer'))
);
--> statement-breakpoint
INSERT INTO `__new_workspace_members`("id", "workspace_id", "user_id", "role", "last_opened_at", "created_at", "updated_at") SELECT "id", "workspace_id", "user_id", "role", "last_opened_at", "created_at", "updated_at" FROM `workspace_members`;--> statement-breakpoint
DROP TABLE `workspace_members`;--> statement-breakpoint
ALTER TABLE `__new_workspace_members` RENAME TO `workspace_members`;--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_members_workspace_user_unique` ON `workspace_members` (`workspace_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `workspace_members_user_id_idx` ON `workspace_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `workspace_members_user_last_opened_at_idx` ON `workspace_members` (`user_id`,`last_opened_at`);
