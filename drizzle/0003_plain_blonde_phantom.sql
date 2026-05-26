ALTER TYPE "public"."content_snapshot_format" ADD VALUE 'document_json' BEFORE 'transcript_json';--> statement-breakpoint
CREATE TABLE "workspace_item_user_state" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"item_id" text NOT NULL,
	"user_id" text NOT NULL,
	"state_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_opened_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_items" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."workspace_item_type";--> statement-breakpoint
CREATE TYPE "public"."workspace_item_type" AS ENUM('folder', 'document', 'file', 'flashcard', 'quiz');--> statement-breakpoint
ALTER TABLE "workspace_items" ALTER COLUMN "type" SET DATA TYPE "public"."workspace_item_type" USING "type"::"public"."workspace_item_type";--> statement-breakpoint
ALTER TABLE "workspace_item_user_state" ADD CONSTRAINT "workspace_item_user_state_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_item_user_state" ADD CONSTRAINT "workspace_item_user_state_item_id_workspace_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."workspace_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_item_user_state" ADD CONSTRAINT "workspace_item_user_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_item_user_state_item_user_unique" ON "workspace_item_user_state" USING btree ("item_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_item_user_state_workspace_user_idx" ON "workspace_item_user_state" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_item_user_state_user_last_opened_at_idx" ON "workspace_item_user_state" USING btree ("user_id","last_opened_at");