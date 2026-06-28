# Legacy ThinkEx → new ThinkEx Migration Tool

Developer-run, single-user migration tool that imports one legacy ThinkEx user's data into new ThinkEx. **Not intended for automated or production use.**

## Why the importer must be deployed

The new app keeps workspace **items** (documents, files, OCR, folders) inside the `WorkspaceKernel` Durable Object. A Durable Object namespace is owned by the deployed Worker, and `wrangler dev --remote` runs Durable Objects locally / in a throwaway preview namespace — so it **cannot** write into the production DO that the live app reads. D1 and R2 writes would land in prod, but the actual item contents would not.

The only way to write into the production WorkspaceKernel DO is to run inside the **deployed production Worker**. So the import is a short **deploy → migrate → strip** flow.

## Workflow (deploy → migrate → strip)

1. Set `MIGRATION_IMPORT_SECRET` as a production Worker secret:
   `wrangler secret put MIGRATION_IMPORT_SECRET --env production`
2. Deploy the Worker with this branch's importer route: `pnpm deploy`
3. Set the CLI env vars locally (see below), including `MIGRATION_IMPORT_URL` pointing at the deployed Worker origin (e.g. `https://thinkex.<account>.workers.dev` or the custom domain).
4. Run the migration for each user: `pnpm tsx scripts/migrate-user.ts --user <email>`
5. When done, remove the route (revert this PR or delete `src/routes/api/admin/migration-import.ts`) and redeploy so the endpoint no longer exists on prod.

While deployed, `/api/admin/migration-import` is publicly reachable, so it is gated by `MIGRATION_IMPORT_SECRET` (rejects unset or mismatched secret). Keep the secret strong and strip the route promptly after migrating.

## Required env vars

### On the deployed Worker (set via `wrangler secret put ... --env production`)

| Variable                  | Description                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `MIGRATION_IMPORT_SECRET` | Shared secret gating the import endpoint. Must be set by a human as a prod Worker secret — not checked in. |

### For the CLI (shell env or `.env` — not committed)

| Variable                      | Description                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `LEGACY_DATABASE_URL`         | Postgres connection string for the old ThinkEx database                                                                                  |
| `LEGACY_SUPABASE_URL`         | e.g. `https://uxcoymwbfcbvkgwbhttq.supabase.co`                                                                                          |
| `LEGACY_SUPABASE_SERVICE_KEY` | Supabase service-role key for downloading file bytes                                                                                     |
| `MIGRATION_IMPORT_SECRET`     | Must match the value set on the Worker                                                                                                   |
| `MIGRATION_IMPORT_URL`        | Origin of the deployed Worker, e.g. `https://thinkex.<account>.workers.dev`. Defaults to `http://localhost:8787` for local testing only. |

## Migration policy (fixed)

**Users**: Only Google-authenticated users (legacy `account.provider_id = 'google'`). Anonymous/credential-only users are dropped.

**Existing new-app users**: If the user already exists in the new app, their legacy workspaces attach to that existing account instead of creating a duplicate. The importer matches in this order: (1) an existing Google account with the same provider `sub`, (2) an existing user with the same email, otherwise (3) it creates a fresh user + Google account preserving the legacy ids. The response reports `matchedBy: "google-account" | "email" | "created"`.

**Workspaces**: Only workspaces OWNED by the migrated user (`workspaces.user_id`). Shared workspaces owned by others are dropped.

**Item types kept**:

- `document` → new `document` (markdown → Tiptap JSON, sourceData preserved)
- `pdf` → new `file` with `assetKind: 'pdf'` (bytes copied to R2, OCR projection migrated)
- `image` → new `file` with `assetKind: 'image'` (bytes copied to R2, OCR projection migrated)
- `folder` → new `folder` (hierarchy preserved, color normalized)

**Item types dropped**: `youtube`, `audio`, `flashcard`, `quiz`

**Data repairs**:

- Duplicate sibling names get an incrementing suffix (`Document`, `Document 2`, `Document 3`)
- Items whose `folder_id` points at a missing/dropped parent are reparented to workspace root
- Folder colors are normalized to the new enum (nearest hue bucket + lightness tier)
- Workspace icons are normalized (Heroicons → Lucide mapping)

**Idempotency**: The importer skips workspaces/items whose preserved ID already exists in D1/kernel.

## What is NOT migrated

- User sessions, tokens, or passwords
- Workspace sharing / memberships (owner-only membership is created)
- YouTube embeds, audio files, flashcards, quizzes
- File preview thumbnails (regenerated by the app on first view)
- Legacy OCR header/footer/tables/hyperlinks fields (only page markdown is kept)

## Running for one user

```bash
# One-time: set the secret on the prod Worker and deploy this branch
wrangler secret put MIGRATION_IMPORT_SECRET --env production
pnpm deploy

# Per user: run the CLI locally against the deployed Worker
export LEGACY_DATABASE_URL="postgres://..."
export LEGACY_SUPABASE_URL="https://uxcoymwbfcbvkgwbhttq.supabase.co"
export LEGACY_SUPABASE_SERVICE_KEY="eyJ..."
export MIGRATION_IMPORT_SECRET="same-value-set-on-the-worker"
export MIGRATION_IMPORT_URL="https://thinkex.<account>.workers.dev"

pnpm tsx scripts/migrate-user.ts --user user@example.com

# When finished migrating everyone: remove the route and redeploy
```

The CLI logs every dropped item type, renamed collision, reparented broken-folder ref, and color/icon fallback.
