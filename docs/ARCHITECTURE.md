# Thinkex Workspace Architecture

## Purpose

Thinkex is a generic collaborative workspace for students, researchers, teams, and businesses. Users work with curated item types such as folders, documents, PDFs, audio, flashcards, quizzes, and future first-party objects. Users do not define arbitrary custom database schemas.

The architecture should make common workspace operations fast and reliable now while leaving room for richer item types, AI actions, file extraction, semantic search, and live collaboration later.

## Current Implementation Alignment

This document describes the target architecture and calls out what is already implemented.

Implemented in the current codebase:

- `workspaces`
- `workspace_members`
- `workspace_items`
- `content_snapshots`
- `item_assets`
- `workspace_item_search`
- `workspace_events`
- TanStack Start server functions in `src/features/workspaces/server/functions.ts`
- TanStack Query options and hierarchical query keys in `src/features/workspaces/query-options.ts` and `src/features/workspaces/cache.ts`
- Route loader prefetching for home and workspace pages
- Create-only workspace item mutation with optimistic cache rollback
- PartyServer/Durable Object workspace room for presence and `workspace.item.created` broadcasts

Planned next schema primitives:

- `workspace_item_user_state`
- `workspace_jobs`

Future-only primitives:

- `workspace_item_permissions`
- semantic/vector chunk tables
- item records/interactions or item-type-specific tables, only after a workflow proves it needs them

## Hard Decisions

Use Postgres as the durable source of truth.

Use JSONB only for typed payloads inside well-scoped tables. Every JSONB payload must have a code-owned schema and mapper. JSONB is an extension point inside Postgres, not a NoSQL escape hatch.

Do not create type-specific tables for every item type up front. Start with the core primitives: item, content snapshot, asset, event, search projection, user state, and job.

Do not make the whole workspace one giant Yjs document. Use Durable Objects for realtime coordination and use Yjs later only for live collaborative editing of an open item.

Do not use Durable Objects as the primary database. Postgres owns durable workspace state; Durable Objects coordinate realtime connections and broadcast committed changes.

Do not treat `workspace_events` as the current-state query model. Events are audit/activity/realtime facts.

## Runtime Architecture

```txt
React UI
  TanStack Router routes
  TanStack Query cache
  Zustand local workspace UI state

TanStack Start
  server functions for app RPCs
  route loaders for initial data
  server modules for DB logic

Postgres
  durable workspace, item, content, event, search, state, and job data

Cloudflare Workers
  production server runtime
  Hyperdrive for production database path
  R2 for binary objects
  Workflows and Queues for async jobs later
  Workers AI, AI Gateway, AI Search, and Vectorize for AI workflows later

Durable Objects / PartyServer
  one workspace room per workspace for presence and committed item events
  future item rooms for live collaborative editing
```

Local development:

- `pnpm dev` is the default app workflow and uses direct `DATABASE_URL`.
- `pnpm dev:cloudflare` is for local Worker/Durable Object behavior and still uses direct database access.
- `pnpm dev:hyperdrive` is a rare production-like Hyperdrive check and can touch remote resources.

## Cloudflare Product Strategy

Prefer Cloudflare platform products when they map directly to the product need. Do not build custom infrastructure before checking whether Cloudflare already provides the primitive.

Use now:

- Workers: production server runtime.
- Hyperdrive: production database path to Postgres.
- Durable Objects / PartyServer: workspace realtime rooms.
- R2: uploaded binary/object storage.
- Workers Observability: Worker runtime visibility.

Use next when the workflow exists:

- Workflows: durable multi-step jobs such as PDF extraction, audio transcription, AI generation, indexing, and human-in-the-loop flows.
- Queues: simple background fanout, batching, and retry transport, especially when a workflow does not need durable step orchestration.
- Workers AI: native Cloudflare inference and platform services such as markdown conversion where they fit quality and cost.
- AI Gateway: model request logging, analytics, caching, rate limiting, retries, and model fallback for Workers AI and external providers.
- AI Search: managed retrieval for workspace/tenant knowledge if it satisfies permission filtering, metadata filtering, freshness, and product control needs.
- Vectorize: lower-level vector database if AI Search is too managed or if Thinkex needs custom chunking, retrieval, metadata, or ranking behavior.
- Browser Run: web import, rendered-page extraction, screenshots, PDFs, and future AI browsing workflows.

Future candidates:

- Cloudflare Agents: private AI workspace/session agents if the built-in state, scheduling, realtime, and tool model fits better than custom chat/session tables.
- Images: image optimization if image-heavy item types or public media delivery become important.
- Stream or RealtimeKit: video/audio workflows only if Thinkex adds rich media playback, recording, or realtime communications.
- Turnstile, Rate Limiting, WAF, and AI Security for Apps: abuse protection and AI safety hardening when public entry points expand.

Cloudflare products are infrastructure primitives, not source-of-truth replacements. Postgres still owns durable application state unless a product is explicitly chosen as the source of truth for a narrow concern.

## TanStack Data Rules

Server functions are the app RPC boundary. Client components and route loaders may call server functions; server functions must enforce auth and permissions themselves.

Routes should load page-level data through TanStack Router loaders and `queryClient.ensureQueryData`. Components should read the same data through TanStack Query.

Prefer page query options for direct route loads when multiple pieces of data are needed together. The current workspace route uses `workspacePageQueryOptions(workspaceId)` to fetch `{ workspace, items }`.

Query keys must stay hierarchical:

```txt
["workspaces"]
["workspaces", workspaceId]
["workspaces", workspaceId, "items"]
["workspaces", workspaceId, "page"]
```

Optimistic cache updates are allowed for actions where instant feedback matters, such as creating a workspace or item. They must:

- cancel relevant queries
- snapshot previous cache values
- write the optimistic value
- rollback on error
- reconcile with the server result on success

Do not add success toasts for routine optimistic actions. Use error toasts when an action fails.

## Core Data Primitives

### `workspaces`

Workspace identity and shared settings.

```txt
id
name
icon
color
description
ownerId
createdAt
updatedAt
archivedAt
```

### `workspace_members`

Workspace-level membership and role. Item-level permissions are future-only.

```txt
id
workspaceId
userId
role          // owner | admin | editor | viewer
lastOpenedAt // per-user home ordering
createdAt
updatedAt
```

Use `workspace_members.lastOpenedAt` for home recency. Updating workspace settings should not change home ordering.

### `workspace_items`

The universal visible node. This is the Drive-like primitive: what exists, where it lives, what type it is, and which snapshots currently represent its content.

```txt
id
workspaceId
parentId
type                  // folder | document | audio | flashcard | quiz | pdf
name
color
sortOrder
layoutJson
metadataJson
indexingPolicy        // default | disabled
sourceVersion
contentHash
currentAuthoredSnapshotId
currentExtractedSnapshotId
createdByUserId
updatedByUserId
createdAt
updatedAt
deletedAt
```

Rules:

- Paths are derived from `parentId`; path strings are not authoritative.
- Folders are regular items.
- List views should query `workspace_items`, not subtype tables.
- `metadataJson` is for lightweight typed metadata only, not file assets or content bodies.
- Parent must be null or a non-deleted folder in the same workspace.
- Names should be unique among non-deleted siblings.

### `content_snapshots`

The durable content/version primitive.

Use snapshots for authored, extracted, and generated content:

- document markdown
- PDF extracted text
- audio transcript JSON plus derived text
- flashcard deck JSON plus derived text
- quiz definition JSON plus derived text
- AI-generated summaries or converted content

```txt
id
workspaceId
itemId
kind                   // authored | extracted | generated
versionNumber
format                 // markdown | plain_text | transcript_json | flashcard_json | quiz_json
contentText
contentJson
yjsStateRef
createdByType          // user | agent | system
createdByUserId
createdByAgentSessionId
reason                 // autosave | ai_edit | import | restore | ocr | transcription | manual
createdAt
```

Snapshots are not a live keystroke log. Autosave should be throttled so each snapshot is a meaningful checkpoint. Future live collaboration can use Yjs while open, then persist durable checkpoints as snapshots.

Every structured `format` must have a schema:

```txt
markdown
  contentText required

plain_text
  contentText required

transcript_json
  contentJson validated as transcript data
  contentText contains derived searchable text

flashcard_json
  contentJson validated as a deck definition
  contentText contains derived searchable text

quiz_json
  contentJson validated as a quiz definition
  contentText contains derived searchable text
```

Do not write arbitrary objects to `contentJson`.

### `item_assets`

Binary/object storage metadata for uploaded or referenced files. Keep this separate from `workspace_items.metadataJson`.

```txt
id
workspaceId
itemId
r2Key
filename
mimeType
sizeBytes
checksum
createdByUserId
createdAt
replacedAt
deletedAt
```

Use cases:

- PDFs
- audio
- future image/video/source files

PDF text extraction and audio transcription should create extracted `content_snapshots`; the active pointer lives on `workspace_items.currentExtractedSnapshotId`.

### `workspace_events`

Append-only audit/activity/realtime facts.

```txt
id
workspaceId
itemId
actorType
actorUserId
actorAgentSessionId
eventType
payloadJson
createdAt
```

Use events for:

- activity feeds
- audit/debug history
- realtime fanout after a committed DB transaction
- async job provenance
- future AI action traces

Events are not the current query model. Current item state comes from `workspace_items`, current content from snapshot pointers, current search from `workspace_item_search`, current job status from `workspace_jobs`, and current per-user resume state from `workspace_item_user_state`.

### `workspace_item_search`

Derived keyword search projection. This is not source of truth.

```txt
itemId
workspaceId
nameText
metadataText
contentText
extractedText
searchVector
currentAuthoredSnapshotId
currentExtractedSnapshotId
status                 // pending | ready | failed
indexError
indexedAt
updatedAt
```

Rules:

- Title/name matches should rank above metadata, authored content, and extracted content.
- Name and lightweight metadata changes can update search synchronously.
- Heavy content, OCR, transcription, and AI indexing can be eventually consistent.
- Semantic search later should add separate chunk/index tables instead of reshaping this projection.

### `workspace_item_user_state`

Planned next primitive. Per-user, per-item resume and UI state. This must not pollute `workspace_items`, because item rows are shared workspace state.

```txt
id
workspaceId
itemId
userId
stateJson
lastOpenedAt
createdAt
updatedAt
```

Use this for:

- PDF last viewed page, zoom, and layout mode
- document scroll/cursor restore
- quiz draft/resume position before submission
- flashcard current card or local review mode
- per-user item view preferences

Do not use this for:

- submitted quiz attempts
- quiz answers and scores
- flashcard review history and due dates
- comments
- annotations
- audit records

Those become future typed workflows only when needed.

### `workspace_jobs`

Planned next primitive. Retryable async work.

```txt
id
workspaceId
itemId
type                  // extract_pdf | transcribe_audio | index_item | ai_generate | process_asset
status                // pending | running | completed | failed | canceled
inputJson
resultJson
error
attempts
runAfter
lockedAt
createdAt
updatedAt
```

Use jobs for:

- PDF extraction
- audio transcription
- search projection rebuilds
- AI-generated summaries, quizzes, flashcards, and cleanup passes
- asset processing

Use Cloudflare Workflows for durable multi-step jobs that need step retries, long-running orchestration, approval, or user-visible progress. Use Cloudflare Queues for simpler background fanout and batching. The DB job row remains useful either way so the app can show status, retry failures, and keep async work auditable. Configure a dead-letter path before treating queued work as production-critical.

## Item Type Composition

Start each curated item type from the shared primitives:

```txt
folder
  workspace_items

document
  workspace_items
  content_snapshots(authored markdown)

pdf
  workspace_items
  item_assets
  content_snapshots(extracted markdown/plain_text later)
  workspace_item_user_state(page/zoom later)

audio
  workspace_items
  item_assets
  content_snapshots(extracted transcript_json later)
  workspace_item_user_state(playback later)

flashcard
  workspace_items
  content_snapshots(authored flashcard_json)
  workspace_item_user_state(resume state later)

quiz
  workspace_items
  content_snapshots(authored quiz_json)
  workspace_item_user_state(draft/resume state later)
```

Do not add subtype tables merely because a type has content. Add future relational tables only when the workflow needs durable sub-item identity or query-heavy behavior.

Good reasons to graduate a workflow:

- quiz attempts need submitted answers, scores, reports, and analytics
- flashcard reviews need due dates, ratings, and spaced repetition state
- PDF annotations need stable anchors, replies, and permissions
- board cards or table rows need filtering, assignment, movement, and independent comments

Bad reasons:

- the JSON shape feels large
- a type might need more data someday
- every item type should have symmetric tables

## Type Schema Registry

Item types are curated by Thinkex. Keep flexibility in code-owned schemas and capability maps.

Each item type should define:

```txt
item type
  supported content formats
  supported asset types
  metadataJson schema
  user state schema
  event payload schemas
  search projection mapper
  realtime capabilities
```

Do not write to `metadataJson`, `contentJson`, `stateJson`, or `payloadJson` without a matching schema and mapper.

## Realtime Architecture

### Workspace Room

One Durable Object / PartyServer room per workspace:

```txt
workspace:{workspaceId}
```

Current use:

- presence snapshots
- committed `workspace.item.created` events

Future workspace broadcasts:

```txt
workspace.item.created
workspace.item.renamed
workspace.item.moved
workspace.item.deleted
workspace.item.restored
workspace.item.reordered
workspace.content.updated
workspace.asset.uploaded
workspace.job.updated
workspace.agent.started
workspace.agent.completed
workspace.agent.failed
```

Rules:

- Write to Postgres first.
- Insert `workspace_events` inside the same transaction when possible.
- After commit, schedule a realtime broadcast with `waitUntil`.
- On reconnect, clients should invalidate or refetch the relevant workspace queries.
- Durable Object rooms may hibernate, so do not rely on in-memory room state as durable truth.

### Item Collaboration Room

Future only. One room per collaboratively edited item:

```txt
workspace:{workspaceId}:item:{itemId}
```

Use this only when live multi-user editing is required. For the next document primitive, a normal throttled snapshot save path is enough.

## AI Workspace Actions

Do not model private AI conversations yet.

When model calls are introduced, route them through Cloudflare AI Gateway when practical so Thinkex gets centralized logging, analytics, caching, rate limits, retries, and model fallback. Workers AI should be the first option for Cloudflare-native inference and markdown conversion when quality and model fit are acceptable. External providers can still be used behind AI Gateway when they are a better product fit.

When AI workspace actions are added, agents should use the same workspace APIs as users:

```txt
listWorkspaceItems
readItem
createItem
moveItem
renameItem
editDocument
editFlashcard
editQuiz
uploadReference
requestExtraction
requestIndexing
```

Every AI action should:

- be permission-checked as the user
- write normal item/content/job/event records
- be visible in audit/activity where appropriate
- avoid private chat/session data leaking into shared workspace records

Cloudflare Agents is a future candidate for private AI workspace sessions. Evaluate it before designing custom long-lived agent runtime, scheduling, tool state, or realtime chat infrastructure. Do not adopt it until the AI chat/session product requirements are clear enough to know whether its Durable Object state model fits.

## Search Strategy

Initial search is keyword search from `workspace_item_search`.

For future semantic or hybrid retrieval, evaluate Cloudflare AI Search first. It provides managed indexing, metadata filtering, and vector/keyword/hybrid modes. Use it if it can satisfy workspace permissions, tenant isolation, freshness, metadata filtering, and result control.

Use Vectorize directly if Thinkex needs lower-level control than AI Search provides. In that case, add separate chunk/index tables:

```txt
workspace_item_chunks
workspace_item_embeddings
```

Do not add vector tables until these decisions are made:

- chunking strategy
- embedding model
- vector dimensions
- reindexing semantics
- permission filtering
- stale-content handling

## Future Item-Level Permissions

Workspace-level permissions are enough initially. Keep permission checks behind helper functions so item-level permissions can be added later without rewriting every mutation.

Future table:

```txt
workspace_item_permissions
  id
  workspaceId
  itemId
  subjectType
  subjectId
  role
  inheritedFromParentId
  createdAt
  updatedAt
```

Do not add this until users need private/shared subtrees inside a workspace.

## Implementation Order

1. Keep the current workspace list/detail/create flows clean and covered.
2. Add `workspace_item_user_state`.
3. Build document open/read/save using throttled authored snapshots.
4. Add `workspace_jobs`.
5. Add search projection writes for item create/update and content snapshot changes.
6. Add rename/move/delete/reorder item mutations only when the UI needs them.
7. Add R2-backed PDF/audio uploads through `item_assets`.
8. Add extraction/transcription jobs with Cloudflare Workflows or Queues as the executor and DB `workspace_jobs` as app-visible status.
9. Extend realtime broadcasts beyond item create.
10. Add Yjs item rooms only when live multi-user editing is required.
11. Add private AI chat after evaluating Cloudflare Agents and route AI edits through the same item/content/job/event APIs.
12. Add semantic indexing later after evaluating AI Search first, then Vectorize/custom chunks only if needed.

## Research Anchors

- TanStack Start server functions are server-side RPCs callable from loaders, hooks, components, and other server functions. They are the app boundary for server-only logic.
- TanStack Router loaders can preload route data, show pending components, and pair well with TanStack Query cache seeding.
- TanStack Query optimistic updates support cancel/snapshot/set/rollback/invalidate patterns; use that pattern for instant workspace/item creation.
- Cloudflare Durable Objects are appropriate for stateful realtime coordination and WebSocket rooms. Hibernation means in-memory state can reset, so durable state belongs in Postgres.
- Cloudflare Workflows provide durable multi-step execution, retries, long-running orchestration, and observability for background workflows.
- Cloudflare Queues support retries and dead-letter queues; use them as async transport when jobs become production-critical.
- Cloudflare R2 is the object store for uploaded binaries; store object metadata in `item_assets`.
- Cloudflare Hyperdrive should be the production database path. Local development should default to direct database access unless specifically testing Hyperdrive.
- Cloudflare Workers AI can provide native inference and markdown conversion via Worker bindings.
- Cloudflare AI Gateway provides AI logging, analytics, caching, rate limiting, retries, and model fallback across Workers AI and external providers.
- Cloudflare AI Search provides managed retrieval with metadata filtering and vector/keyword/hybrid search modes; evaluate it before building custom retrieval.
- Cloudflare Vectorize is the lower-level vector database option when custom retrieval control is required.
- Cloudflare Browser Run is the preferred Cloudflare primitive for rendered webpage import, screenshots, PDFs, and future browser-based agent tasks.
- PostgreSQL GIN indexes are the preferred index type for regular full-text search workloads.
