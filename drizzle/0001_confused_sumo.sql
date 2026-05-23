CREATE TYPE "public"."content_actor_type" AS ENUM('user', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."content_snapshot_format" AS ENUM('markdown', 'plain_text', 'transcript_json', 'flashcard_json', 'quiz_json');--> statement-breakpoint
CREATE TYPE "public"."content_snapshot_kind" AS ENUM('authored', 'extracted', 'generated');--> statement-breakpoint
CREATE TYPE "public"."content_snapshot_reason" AS ENUM('autosave', 'ai_edit', 'import', 'restore', 'ocr', 'transcription', 'manual');--> statement-breakpoint
CREATE TYPE "public"."workspace_event_actor_type" AS ENUM('user', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."workspace_indexing_policy" AS ENUM('default', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."workspace_item_type" AS ENUM('folder', 'document', 'audio', 'flashcard', 'quiz', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."workspace_search_index_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "content_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"item_id" text NOT NULL,
	"kind" "content_snapshot_kind" NOT NULL,
	"format" "content_snapshot_format" NOT NULL,
	"version_number" integer NOT NULL,
	"content_text" text,
	"content_json" jsonb,
	"yjs_state_ref" text,
	"created_by_type" "content_actor_type" NOT NULL,
	"created_by_user_id" text,
	"created_by_agent_session_id" text,
	"reason" "content_snapshot_reason" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"item_id" text NOT NULL,
	"r2_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" text,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"replaced_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workspace_events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"item_id" text,
	"actor_type" "workspace_event_actor_type" NOT NULL,
	"actor_user_id" text,
	"actor_agent_session_id" text,
	"event_type" text NOT NULL,
	"payload_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_item_search" (
	"item_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name_text" text NOT NULL,
	"metadata_text" text,
	"content_text" text,
	"extracted_text" text,
	"search_vector" "tsvector" GENERATED ALWAYS AS (
					setweight(to_tsvector('english', coalesce("workspace_item_search"."name_text", '')), 'A') ||
					setweight(to_tsvector('english', coalesce("workspace_item_search"."metadata_text", '')), 'B') ||
					setweight(to_tsvector('english', coalesce("workspace_item_search"."content_text", '')), 'C') ||
					setweight(to_tsvector('english', coalesce("workspace_item_search"."extracted_text", '')), 'D')
				) STORED NOT NULL,
	"current_authored_snapshot_id" text,
	"current_extracted_snapshot_id" text,
	"status" "workspace_search_index_status" DEFAULT 'pending' NOT NULL,
	"index_error" text,
	"indexed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_items" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"parent_id" text,
	"type" "workspace_item_type" NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"layout_json" jsonb,
	"metadata_json" jsonb,
	"indexing_policy" "workspace_indexing_policy" DEFAULT 'default' NOT NULL,
	"source_version" integer DEFAULT 1 NOT NULL,
	"content_hash" text,
	"current_authored_snapshot_id" text,
	"current_extracted_snapshot_id" text,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "workspace_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text,
	"description" text,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "content_snapshots" ADD CONSTRAINT "content_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_snapshots" ADD CONSTRAINT "content_snapshots_item_id_workspace_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."workspace_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_snapshots" ADD CONSTRAINT "content_snapshots_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_assets" ADD CONSTRAINT "item_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_assets" ADD CONSTRAINT "item_assets_item_id_workspace_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."workspace_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_assets" ADD CONSTRAINT "item_assets_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_events" ADD CONSTRAINT "workspace_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_events" ADD CONSTRAINT "workspace_events_item_id_workspace_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."workspace_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_events" ADD CONSTRAINT "workspace_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_item_search" ADD CONSTRAINT "workspace_item_search_item_id_workspace_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."workspace_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_item_search" ADD CONSTRAINT "workspace_item_search_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_items" ADD CONSTRAINT "workspace_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_items" ADD CONSTRAINT "workspace_items_parent_id_workspace_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."workspace_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_items" ADD CONSTRAINT "workspace_items_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_items" ADD CONSTRAINT "workspace_items_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_snapshots_item_kind_version_unique" ON "content_snapshots" USING btree ("item_id","kind","version_number");--> statement-breakpoint
CREATE INDEX "content_snapshots_workspace_item_idx" ON "content_snapshots" USING btree ("workspace_id","item_id");--> statement-breakpoint
CREATE INDEX "content_snapshots_item_kind_created_at_idx" ON "content_snapshots" USING btree ("item_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "item_assets_workspace_item_idx" ON "item_assets" USING btree ("workspace_id","item_id");--> statement-breakpoint
CREATE INDEX "item_assets_item_active_idx" ON "item_assets" USING btree ("item_id","replaced_at","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "item_assets_r2_key_unique" ON "item_assets" USING btree ("r2_key");--> statement-breakpoint
CREATE INDEX "workspace_events_workspace_created_at_idx" ON "workspace_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "workspace_events_item_created_at_idx" ON "workspace_events" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE INDEX "workspace_item_search_workspace_idx" ON "workspace_item_search" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_item_search_status_idx" ON "workspace_item_search" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workspace_item_search_vector_idx" ON "workspace_item_search" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "workspace_items_workspace_parent_idx" ON "workspace_items" USING btree ("workspace_id","parent_id");--> statement-breakpoint
CREATE INDEX "workspace_items_workspace_type_idx" ON "workspace_items" USING btree ("workspace_id","type");--> statement-breakpoint
CREATE INDEX "workspace_items_parent_id_idx" ON "workspace_items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "workspace_items_deleted_at_idx" ON "workspace_items" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_items_workspace_parent_name_unique" ON "workspace_items" USING btree ("workspace_id",coalesce("parent_id", ''),"name") WHERE "workspace_items"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_workspace_user_unique" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaces_owner_id_idx" ON "workspaces" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "workspaces_archived_at_idx" ON "workspaces" USING btree ("archived_at");