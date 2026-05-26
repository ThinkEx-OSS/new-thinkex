# Thinkex Workspace Architecture

## Purpose

Thinkex is a generic collaborative workspace for students, researchers, teams, and businesses. The product should feel like an AI-native operating system on the web: users organize files and first-party objects, open them in the right viewer or editor, collaborate in focused contexts, and let AI inspect, transform, generate, or eventually run workspace material in controlled runtimes.

Users work with curated item types such as folders, documents, file assets, flashcards, quizzes, whiteboards, boards, and future first-party objects. Users do not define arbitrary custom database schemas.

The architecture should make common workspace operations fast and reliable now while leaving room for richer item types, safe file imports, AI actions, file extraction, semantic search, live collaboration, and future sandbox execution.

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
- `workspace_item_user_state`
- a general `file` item type for uploaded/reference assets
- an initial object registry in `src/features/workspaces/model/object-registry.ts`
- TanStack Start server functions in `src/features/workspaces/server/functions.ts`
- TanStack Query options and hierarchical query keys in `src/features/workspaces/query-options.ts` and `src/features/workspaces/cache.ts`
- Route loader prefetching for home and workspace pages
- Create-only workspace item mutation with optimistic cache rollback
- PartyServer/Durable Object workspace room for presence and `workspace.item.created` broadcasts

Planned next implementation primitives:

- content snapshot read/write APIs
- server-side upload classification
- private R2 asset routes
- viewer/editor registry wiring
- job/executor design after choosing the first Cloudflare Workflows or Queues implementation

Future-only primitives:

- `workspace_item_permissions`
- semantic/vector chunk tables
- sandbox run/session tables
- item records/interactions or item-type-specific tables, only after a workflow proves it needs them

## Hard Decisions

Use Postgres as the durable source of truth.

Use JSONB only for typed payloads inside well-scoped tables. Every JSONB payload must have a code-owned schema and mapper. JSONB is an extension point inside Postgres, not a NoSQL escape hatch.

Do not create type-specific tables for every item type up front. Start with the core primitives: item, content snapshot, asset, event, search projection, user state, and job.

Do not make the whole workspace one giant Yjs document. Use Durable Objects for realtime coordination and use Yjs later only for live collaborative editing of an open item.

Do not use Durable Objects as the primary database. Postgres owns durable workspace state; Durable Objects coordinate realtime connections and broadcast committed changes.

Do not treat `workspace_events` as the current-state query model. Events are audit/activity/realtime facts.

Do not model every file type as a separate table. Add new object behavior through a type registry, capability map, viewer/editor map, processors, and snapshots. Promote to relational subtype tables only when a workflow needs durable sub-object identity, heavy querying, or independent permissions.

Do not convert every file into a Thinkex document. A C++ file, PDF, image, audio file, whiteboard, flashcard deck, and quiz can all be workspace items, but they do not have the same editor, content model, realtime needs, or AI actions.

Do not attach high-frequency item collaboration to the workspace root. The workspace room is for presence and committed workspace events. Google Docs-style editing, whiteboard sync, and code/text live editing belong to item-level rooms that are activated only when that item is open in a tab, pane, or focused surface.

## Workspace OS Kernel

Thinkex should be organized around stable kernel primitives:

```txt
Workspace
  tenant/project boundary

Item
  addressable workspace node: folder, native object, or file

Asset
  original binary/object in R2 plus detected type metadata

Content
  authored, extracted, or generated representation

View
  user-facing viewer/editor surface for the item

Capability
  allowed operation for this item and current user

Job
  retryable async work against items, assets, or content

Runtime
  isolated future execution environment for code/tool runs

Event
  committed audit/realtime fact

Permission
  workspace-level now, item-level later
```

Important separations:

- A file is not the same thing as its extracted content.
- A viewer is not the same thing as an editor.
- An AI-readable representation is not the same thing as the original asset.
- A sandbox runtime is not the same thing as the app server or database.
- Realtime workspace presence is not the same thing as item-level collaborative editing.

New object families should be added by declaring classification, storage, capabilities, viewer/editor, processors, AI actions, and realtime model. They should not require new architectural paths.

## Object Registry

Each item type or file family should have an application-owned registry entry:

```txt
type or family
  storage model
  allowed asset types
  authored content formats
  extracted content formats
  metadataJson schema
  user state schema
  event payload schemas
  capabilities
  viewer/editor
  processors
  AI tools allowed
  realtime model
  promotion path
```

Capabilities should be explicit. Initial capability vocabulary:

```txt
view
edit_text
edit_rich_text
edit_structured
extract_text
ocr
transcribe
convert
index
ai_read
ai_edit
collaborate
run_in_sandbox
```

Examples:

```txt
document
  storage: workspace_items + authored markdown/prosemirror snapshot
  viewer/editor: Tiptap editor
  capabilities: view, edit_rich_text, index, ai_read, ai_edit
  realtime: throttled snapshots first; item room later for live collaboration

text/code file
  storage: workspace_items + original asset + authored text snapshot
  viewer/editor: text editor now, code editor later
  capabilities: view, edit_text, index, ai_read, ai_edit, run_in_sandbox later
  realtime: throttled snapshots first; item room later if actively open

pdf
  storage: workspace_items + original asset + extracted snapshot later
  viewer/editor: PDF viewer
  capabilities: view, extract_text, index, ai_read after extraction
  realtime: no high-frequency item room

image
  storage: workspace_items + original asset + OCR snapshot later
  viewer/editor: image viewer
  capabilities: view, ocr later, index after OCR
  realtime: no high-frequency item room

audio
  storage: workspace_items + original asset + transcript snapshot later
  viewer/editor: audio player
  capabilities: view, transcribe later, index after transcription
  realtime: no high-frequency item room

whiteboard
  storage: workspace_items + structured authored snapshot
  viewer/editor: whiteboard editor, likely tldraw
  capabilities: view, edit_structured, collaborate, index via derived summary later, ai_read later
  realtime: item room only while board is open

kanban
  storage: workspace_items + structured authored snapshot initially
  viewer/editor: board editor
  capabilities: view, edit_structured, index, ai_read, ai_edit, collaborate later
  realtime: workspace events first; item room later if edits become high-frequency

flashcard
  storage: workspace_items + flashcard_json snapshot
  viewer/editor: deck editor/study UI
  capabilities: view, edit_structured, index, ai_read, ai_edit
  promotion path: review history and spaced repetition tables later

quiz
  storage: workspace_items + quiz_json snapshot
  viewer/editor: quiz editor/taking UI
  capabilities: view, edit_structured, index, ai_read, ai_edit
  promotion path: attempts, answers, scores, and reports later
```

The registry is also the AI contract. AI should not infer arbitrary write behavior from file extensions. It should ask the registry which tools are available for the target item.

## Viewers, Editors, And Derivatives

Thinkex should make the user-facing distinction clear:

```txt
viewer
  opens source material safely without promising edit fidelity

editor
  modifies a Thinkex-owned content model

derivative
  a new Thinkex item or snapshot generated from source material
```

Rules:

- PDFs, images, and audio are source/reference items first.
- Text/code files may be editable because their content model is simple, but the original uploaded asset remains immutable.
- DOCX, PPTX, XLSX, video, and archives stay disabled until their viewer/processor/importer path is honest.
- AI summaries, outlines, documents, flashcards, quizzes, converted documents, transcripts, OCR output, and sandbox artifacts should be derivatives, not silent overwrites of source assets.
- A user should always be able to tell whether they are editing the source object or a derived Thinkex object.

## Runtime Architecture

```txt
React UI
  TanStack Router routes
  TanStack Query cache
  Zustand local workspace UI state
  viewer/editor registry

TanStack Start
  server functions for app RPCs
  route loaders for initial data
  server modules for DB logic
  upload classification and asset authorization

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
  item rooms only for open collaborative items

Sandbox / Runtime layer later
  isolated code/tool execution
  rehydrated from workspace assets and content
  writes logs, artifacts, snapshots, jobs, and events back through app APIs
```

Local development:

- `pnpm dev` is the default app workflow and uses direct `DATABASE_URL`.
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
- Sandbox SDK / Containers: isolated code execution, package installs, tests, data processing, and future AI developer/runtime workflows.
- Cloudflare Agents: durable agent identities, schedules, state, and WebSocket interaction when the product has clear long-lived agent requirements.

Future candidates:

- Images: image optimization if image-heavy item types or public media delivery become important.
- Stream or RealtimeKit: video/audio workflows only if Thinkex adds rich media playback, recording, or realtime communications.
- Turnstile, Rate Limiting, WAF, and AI Security for Apps: abuse protection and AI safety hardening when public entry points expand.

Cloudflare products are infrastructure primitives, not source-of-truth replacements. Postgres still owns durable application state unless a product is explicitly chosen as the source of truth for a narrow concern.

Cloudflare Agents are durable identities, not always-on processes. Agent state can survive hibernation, but in-memory variables, timers, open fetches, and closures should not be treated as durable. Use Agents for addressable long-lived agent sessions, Workflows for heavyweight multi-step jobs, and the DB for app-visible state.

Sandbox containers are execution environments, not durable workspace storage. They can execute commands, manage files, run background processes, and expose services, but they can restart or lose ephemeral state. Every sandbox run must be reproducible from authorized workspace inputs and must write durable outputs back through normal workspace APIs.

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
type                  // folder | document | file | flashcard | quiz
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
format                 // markdown | plain_text | document_json | transcript_json | flashcard_json | quiz_json
contentText
contentJson
yjsStateRef
createdByType          // user | agent | system
createdByUserId
createdByAgentSessionId
reason                 // autosave | ai_edit | import | restore | ocr | transcription | manual
createdAt
```

Thinkex documents should use Tiptap/ProseMirror for the editing surface. Users should not have to work with Markdown directly. The durable document representation should stay code-owned and conversion-safe: store the editor-native structured representation when needed, and maintain Markdown/plain text projections for search, AI, export, and portability. Do not assume Markdown alone can faithfully represent every future rich editor feature.

Snapshots are not a live keystroke log. Autosave should be throttled so each snapshot is a meaningful checkpoint. Future live collaboration can use a CRDT or editor collaboration layer while an item is open, then persist durable checkpoints as snapshots.

Every structured `format` must have a schema:

```txt
markdown
  contentText required

plain_text
  contentText required

document_json
  contentJson validated as Thinkex authored document JSON. In v1 this is Tiptap/ProseMirror-compatible, but the app-level contract stays Thinkex-owned.
  contentText contains markdown/plain-text projection

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
- images
- text/code files
- future video, Office, archive, and source bundle imports

PDF text extraction and audio transcription should create extracted `content_snapshots`; the active pointer lives on `workspace_items.currentExtractedSnapshotId`.

Audio recording is an acquisition flow, not a separate workspace item type. The browser recorder should request microphone access, produce an audio blob, upload it through the same accepted-asset path as an existing audio file, create `workspace_items(type=file)`, create the `item_assets` row, then enqueue future transcription/extraction work. Uploaded audio and recorded audio should share storage, permissions, viewer, transcript, indexing, and AI-read paths; only the client-side capture step differs.

### File Import Policy

Uploads should be default-deny and allowlist-based. Browser-provided MIME types and filenames are user-controlled hints, not authority.

Every upload should pass through a server-side classifier:

```txt
read bounded header sample
detect binary signature / magic bytes when available
normalize extension and claimed MIME type
classify into file family
enforce size, count, and family policy
derive capabilities and processor plan
write original asset only after acceptance
```

Use binary signature detection for binary formats and separate text detection for text-like formats. Detection is a best-effort classification layer, not a security scanner. The upload policy must still enforce allowed families, file size limits, parser limits, and future malware/scanning controls where needed.

Initial upload families:

```txt
pdf
  status: allow
  original: private R2 asset
  v1: viewer only
  soon: extract_text job, search projection, AI-readable snapshot

image
  status: allow
  original: private R2 asset
  v1: viewer only
  later: OCR job, thumbnails, image optimization

audio
  status: allow
  original: private R2 asset
  v1: playback only
  later: transcription job, search projection, AI-readable transcript

text/markdown/code
  status: allow
  original: private R2 asset
  v1: editable text snapshot
  later: code editor, language-aware actions, sandbox execution

office
  status: planned, disabled until conversion exists
  original: private R2 asset
  later: DOCX/PPTX to PDF/markdown, XLSX to structured table model

video
  status: planned, disabled for v1
  later: playback, thumbnails, transcription, scene extraction, stream/transcode decision

archive
  status: planned importer, disabled for v1
  later: explicit import flow with max files, max depth, max uncompressed size, path traversal checks, nested archive policy, blocked executable policy, and scanning

unknown/executable
  status: reject
```

Original uploaded assets should remain immutable by default. User and AI edits should create authored snapshots or derived native items. Derived summaries, outlines, flashcards, quizzes, converted documents, extracted text, OCR output, transcripts, and sandbox artifacts should preserve provenance back to the source item through metadata and events.

R2 objects must be private by default. Reads should go through authorization-aware Worker routes or short-lived signed access after checking workspace membership. Public object URLs should not be the default for workspace data.

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

Events are not the current query model. Current item state comes from `workspace_items`, current content from snapshot pointers, current search from `workspace_item_search`, future job status from the eventual job/executor table, and current per-user resume state from `workspace_item_user_state`.

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

Per-user, per-item durable resume state. This must not pollute `workspace_items`, because item rows are shared workspace state.

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

Use judgment before writing here. Cross-device, product-visible resume state belongs in Postgres. Purely local UI preferences can stay in local storage.

Good DB state:

- last opened item position when users expect continuity across devices
- quiz draft position before submission
- flashcard deck resume position
- per-user viewer state that affects product behavior

Good local-only state:

- transient split-pane sizes
- hover/open menu state
- one-device zoom preference unless users expect sync
- unsaved editor cursor noise before autosave/collaboration exists

### `workspace_jobs`

Future primitive. Retryable async work.

Do not add the table until the first real executor is chosen. The shape below is the expected app-visible job model, but details may change once Cloudflare Workflows, Queues, or another executor is selected for the first processor.

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
  content_snapshots(authored document_json/markdown projection)

file
  workspace_items
  item_assets(original private R2 object)
  content_snapshots(extracted/generated later depending on family)
  workspace_item_user_state(viewer state later)

text/code
  workspace_items(file family or future code type)
  item_assets(original private R2 object)
  content_snapshots(authored plain_text or markdown/prosemirror wrapper)
  workspace_item_user_state(cursor/scroll later)

pdf
  workspace_items(type=file, family=pdf)
  item_assets
  content_snapshots(extracted markdown/plain_text later)
  workspace_item_user_state(page/zoom later)

audio
  workspace_items(type=file, family=audio)
  item_assets
  content_snapshots(extracted transcript_json later)
  workspace_item_user_state(playback later)

image
  workspace_items(file family)
  item_assets
  content_snapshots(extracted OCR text later)
  workspace_item_user_state(viewer state later)

flashcard
  workspace_items
  content_snapshots(authored flashcard_json)
  workspace_item_user_state(resume state later)

quiz
  workspace_items
  content_snapshots(authored quiz_json)
  workspace_item_user_state(draft/resume state later)
```

Future native structured objects:

```txt
whiteboard
  workspace_items
  content_snapshots(authored future whiteboard_json)
  item-level realtime room when open

kanban
  workspace_items
  content_snapshots(authored future board_json)
  item-level realtime room only if edits become high-frequency
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

## Learning Objects

Flashcards and quizzes are first-party Thinkex objects, not generic documents.

Flashcards should borrow from Anki's conceptual model:

```txt
deck
  collection of notes/cards

note
  authored source fields

card
  reviewable prompt/answer generated from note fields and templates

media
  image/audio attachments referenced by cards

scheduling/review state
  per-user learning history, due dates, ratings, intervals
```

Do not use `.apkg` as the primary internal storage format. Use `flashcard_json` as the first internal representation and support Anki import/export later if users need interoperability.

Early flashcard storage:

```txt
workspace_items(type=flashcard)
content_snapshots(kind=authored, format=flashcard_json)
workspace_item_user_state for lightweight resume state
```

Graduate to typed relational tables only when Thinkex needs real spaced repetition: due dates, ratings, intervals, review history, leeches, buried/suspended cards, analytics, or large deck queries.

Quizzes follow the same rule. Use `quiz_json` for definitions first. Add attempt/answer/report tables only when submitted attempts, grading, analytics, or durable learner records exist.

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
- The root workspace page should subscribe to workspace-level facts only: presence, item creates/renames/moves/deletes, job status, and activity events.
- The root workspace page should not subscribe to every open document's CRDT stream, whiteboard stream, or code/text editing stream.
- Opening an item in a tab, pane, split view, or focused surface activates only that item's realtime channel.
- Closing or backgrounding the item should detach high-frequency item collaboration unless the UI explicitly needs background sync.

### Item Collaboration Room

Future only. One room per collaboratively edited item, activated only while the item is open:

```txt
workspace:{workspaceId}:item:{itemId}
```

Use this only when live multi-user editing is required. For the next document primitive, a normal throttled snapshot save path is enough.

Likely item-room users:

- Tiptap/ProseMirror document collaboration
- text/code editing collaboration
- tldraw whiteboards
- high-frequency structured board/table editing

Presence and awareness state such as cursors, selections, and viewport should be ephemeral and item-scoped. It should not be written into durable content snapshots unless the product explicitly introduces annotations or comments.

Yjs/Hocuspocus-style collaboration remains a candidate for rich text and code/text editing. If adopted, persist the CRDT update format correctly and also write durable content checkpoints for search, export, AI, restore, and version history. Do not treat transient CRDT state as the only product record.

tldraw is a strong candidate for whiteboards because it has JSON snapshots, migrations, and multiplayer sync patterns. Treat whiteboard data as structured authored snapshots plus item-level collaboration, not as document markdown.

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
editTextFile
createDerivedItem
uploadReference
requestExtraction
requestIndexing
requestSandboxRun
```

Every AI action should:

- be permission-checked as the user
- write normal item/content/job/event records
- be visible in audit/activity where appropriate
- avoid private chat/session data leaking into shared workspace records
- consult the object registry before reading, editing, converting, or executing an item
- prefer normalized content snapshots and search projections over raw binaries
- touch raw assets only inside explicit processors or sandbox/runtime jobs

Cloudflare Agents is a future candidate for private AI workspace sessions. Evaluate it before designing custom long-lived agent runtime, scheduling, tool state, or realtime chat infrastructure. Do not adopt it until the AI chat/session product requirements are clear enough to know whether its Durable Object state model fits.

TanStack AI and Vercel AI SDK are candidates for model streaming, chat transport, tool calling, and client/server integration. They are not durable product state by themselves. Thinkex should keep agent runs, approvals, artifacts, and workspace mutations in app tables/events. The SDK choice can be swapped more easily if the AI action layer is behind internal tools.

OpenAI Agents SDK-style concepts are useful design references: server-owned orchestration, tool execution, handoffs, guardrails, human review, tracing, and sandbox-backed agents. Do not let a hosted or SDK-specific agent framework own Thinkex's workspace mutation semantics.

### AI Skill System

Thinkex should use a skill/tool registry to avoid putting every workflow instruction in one giant system prompt.

A skill is a focused bundle:

```txt
id
description
when to use
allowed item families/capabilities
instructions
tools required
input schema
output schema
approval requirements
security constraints
version
```

Skills should be loaded by relevance and object capability:

```txt
summarize_pdf
generate_flashcards_from_sources
edit_tiptap_document
refactor_code_file
run_code_in_sandbox
convert_docx_to_pdf
extract_xlsx_tables
summarize_whiteboard
organize_kanban
```

Rules:

- Skills describe how to use existing app tools; they are not a permission bypass.
- Tool execution remains server-side and permission-checked.
- High-risk skills require approval gates before writes, external network access, sandbox execution, or bulk mutations.
- Skills should be versioned so old agent runs remain auditable.
- The object registry should decide which skills are eligible for a selected item.

### Sandbox Runtime

Sandbox execution is a future runtime capability, not a v1 upload requirement.

The model:

```txt
1. User or AI requests a run against selected workspace items.
2. Server checks permissions and registry capabilities.
3. A job records requested inputs, limits, runtime profile, and approval state.
4. Runtime materializes authorized assets/content into an isolated filesystem.
5. Runtime executes commands with CPU, memory, duration, network, and file limits.
6. Logs, outputs, artifacts, and proposed edits return as job results.
7. User or approved AI action writes artifacts/new snapshots/new items through normal workspace APIs.
8. Events broadcast committed changes.
```

Never let a sandbox mutate Postgres or R2 directly. The sandbox should receive scoped inputs and produce outputs. The app server remains the commit authority.

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

Future permissions may need both role and visibility:

```txt
role
  can read/edit/manage an item

visibility
  whether the item appears in navigation/search/activity for a subject
```

Do not add this now. It becomes necessary when Thinkex supports private folders, shared subtrees, role-specific objects, classroom/team visibility, hidden instructor materials, or private AI/user work products inside a shared workspace.

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
2. Add the object registry in code: item types, file families, capabilities, viewers/editors, processors, AI actions, and realtime model.
3. Add `workspace_item_user_state`.
4. Build document open/read/save using Tiptap and throttled authored snapshots.
5. Add a general file item/family model and server-side upload classifier.
6. Add private R2-backed uploads through `item_assets` for v1 allowlisted families: PDF, image, audio, text/markdown/code.
7. Add file viewers: PDF viewer, image viewer, audio player, and text/code editor surface.
8. Add search projection writes for item create/update and content snapshot changes.
9. Design the job/executor table when the first real processor is selected.
10. Add extraction/transcription/OCR jobs with Cloudflare Workflows or Queues as the executor and a DB-backed app-visible status model.
11. Add derived item flows: summarize, outline, generate document, generate flashcards, generate quiz.
12. Extend realtime broadcasts beyond item create.
13. Add item-level realtime rooms only for open collaborative items.
14. Add whiteboard/kanban native structured objects through the registry after documents/files are stable.
15. Add private AI chat/session after evaluating Cloudflare Agents and route AI edits through the same item/content/job/event APIs.
16. Add sandbox runtime after there is a clear project/code execution workflow and an approval/security model.
17. Add Office importers only when conversion/extraction is ready: DOCX/PPTX to PDF/markdown, XLSX to structured tables.
18. Add archive importers only as a dedicated controlled import flow, not generic upload.
19. Add semantic indexing later after evaluating AI Search first, then Vectorize/custom chunks only if needed.

## Research Anchors

- TanStack Start server functions are server-side RPCs callable from loaders, hooks, components, and other server functions. They are the app boundary for server-only logic.
- TanStack Router loaders can preload route data, show pending components, and pair well with TanStack Query cache seeding.
- TanStack Query optimistic updates support cancel/snapshot/set/rollback/invalidate patterns; use that pattern for instant workspace/item creation.
- Cloudflare Durable Objects are appropriate for stateful realtime coordination and WebSocket rooms. WebSocket hibernation means clients can stay connected while the object sleeps, but in-memory state can reset, so durable state belongs in Postgres.
- Cloudflare Agents are durable identities with state, scheduling, and hibernation behavior. They are candidates for long-lived agent sessions, not replacements for app tables.
- Cloudflare Workflows provide durable multi-step execution, retries, long-running orchestration, progress reporting, and observability for background workflows.
- Cloudflare Queues support retries and dead-letter queues; use them as async transport when jobs become production-critical.
- Cloudflare R2 is the object store for uploaded binaries; store object metadata in `item_assets`.
- Cloudflare R2 can be accessed through Worker bindings or presigned URLs. Workspace data should stay private and authorization-aware by default.
- Cloudflare Hyperdrive should be the production database path. Local development should default to direct database access unless specifically testing Hyperdrive.
- Cloudflare Workers AI can provide native inference and markdown conversion via Worker bindings.
- Cloudflare AI Gateway provides AI logging, analytics, caching, rate limiting, retries, and model fallback across Workers AI and external providers.
- Cloudflare AI Search provides managed retrieval with metadata filtering and vector/keyword/hybrid search modes; evaluate it before building custom retrieval.
- Cloudflare Vectorize is the lower-level vector database option when custom retrieval control is required.
- Cloudflare Browser Run is the preferred Cloudflare primitive for rendered webpage import, screenshots, PDFs, and future browser-based agent tasks.
- Cloudflare Sandbox SDK / Containers can run untrusted code, manage files, run commands/background processes, and expose services from Workers. Sandbox state should be treated as ephemeral and rehydratable from workspace inputs.
- TanStack AI and Vercel AI SDK are candidates for streaming, tool calling, client integration, and agent loops. Keep product state and mutation authority in Thinkex APIs so this layer remains replaceable.
- OpenAI Agents SDK-style orchestration provides useful concepts: server-owned tools, handoffs, guardrails, human review, tracing, and sandbox-backed agents.
- Agent Skills are useful as progressively loaded task instructions plus scripts/resources. Treat Thinkex skills as versioned, permission-checked workflow modules, not as trusted user prompts.
- File type detection by magic bytes is useful but best-effort. Combine it with extension normalization, claimed MIME validation, allowlists, parser limits, and future scanning.
- Tiptap/ProseMirror should be the rich document editing surface. Persist editor-native structured content when needed and maintain Markdown/plain-text projections for search, AI, export, and portability.
- Yjs/Hocuspocus are candidates for item-level collaborative editing. Persist Yjs data in its encoded update format when using it, and keep durable content checkpoints for product history and AI/search.
- tldraw is a strong whiteboard candidate because it supports JSON snapshots, migrations, and multiplayer sync patterns including Cloudflare Durable Object deployments.
- Anki's deck model distinguishes notes, note types, cards, decks, media, and scheduling. Thinkex flashcards should borrow the note/card/deck separation where useful, but should not adopt `.apkg` as the primary internal storage format. Support import/export later.
- PostgreSQL GIN indexes are the preferred index type for regular full-text search workloads.
