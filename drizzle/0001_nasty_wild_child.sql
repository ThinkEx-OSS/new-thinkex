CREATE TYPE "public"."workspace_invite_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."workspace_invite_type" AS ENUM('email', 'link');--> statement-breakpoint
CREATE TABLE "workspace_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"role" "workspace_role" NOT NULL,
	"type" "workspace_invite_type" NOT NULL,
	"status" "workspace_invite_status" DEFAULT 'pending' NOT NULL,
	"email" text,
	"token" text,
	"created_by_user_id" text NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invites_token_unique" ON "workspace_invites" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invites_pending_link_per_role" ON "workspace_invites" USING btree ("workspace_id","role") WHERE "workspace_invites"."type" = 'link' and "workspace_invites"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invites_pending_email_per_workspace" ON "workspace_invites" USING btree ("workspace_id","email") WHERE "workspace_invites"."type" = 'email' and "workspace_invites"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "workspace_invites_workspace_id_idx" ON "workspace_invites" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invites_created_by_user_id_idx" ON "workspace_invites" USING btree ("created_by_user_id");