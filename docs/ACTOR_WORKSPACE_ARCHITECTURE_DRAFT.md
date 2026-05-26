# Thinkex Actor-First Workspace Architecture Draft

## Status

This is a research draft for migrating the current Postgres-first workspace architecture toward an actor-first model built around Cloudflare Durable Objects and Agents.

The existing architecture in `docs/ARCHITECTURE.md` remains the implemented source of truth today. This document explores a possible next architecture, the migration path, the assumptions behind it, and the questions that still need validation before committing to the direction.

## Product Thesis

Thinkex workspaces are closer to user-facing filesystems than generic database apps. Users organize study, research, and business operations inside a bounded workspace. They usually operate in one workspace at a time, while the AI may need controlled cross-workspace memory and retrieval.

That product shape makes a workspace actor plausible:

```txt
Workspace
  a durable, collaborative, AI-readable filesystem-like world

Workspace actor
  the authority for tree state, item metadata, commands, local events, and live presence

Item actors
  optional high-frequency collaboration runtimes for open documents, whiteboards, code files, and similar items

AI agent
  a native participant that reads and writes through the same command surface as users
```

The target user experience should still be non-technical. Users see folders, tabs, editors, viewers, flashcards, quizzes, search, and AI. The actor/filesystem model is an internal architecture, not a developer-facing abstraction exposed to normal users.

## Research Snapshot

This draft is based on the current repo plus Cloudflare documentation checked on 2026-05-26.

Relevant Cloudflare findings:

- Durable Objects are intended for coordinated stateful applications such as collaborative editing, chat rooms, multiplayer, and live notifications.
- SQLite-backed Durable Objects provide strongly consistent transactional storage that is private to one object instance.
- SQLite-backed Durable Objects on Workers Paid have a 10 GB per-object storage limit, a 2 MB max row/string/BLOB size, and an individual-object soft throughput guideline around 1,000 requests per second.
- Durable Objects can use WebSocket hibernation so clients stay connected while in-memory state is reset. Durable state must be persisted, not kept only in class fields.
- R2 is strongly consistent for object write/read/delete/list and metadata updates, making it suitable for large workspace assets and snapshot bodies.
- Cloudflare Agents provide persisted state, SQL access, WebSocket state sync, and sub-agents.
- Agent sub-agents are co-located child Durable Objects with isolated SQLite storage and typed parent-child RPC. This is close to a workspace parent with item children.
- AI Search supports metadata filtering and per-tenant patterns, which may support derived cross-workspace retrieval if permission metadata is modeled carefully.
- Durable Objects support jurisdiction restrictions and location hints, but currently do not dynamically move existing objects after creation.
- The current Thinkex chat implementation already uses a parent/sub-agent pattern: one `WorkspaceChatDirectory` Agent per user and one `WorkspaceChatAgent` sub-agent per thread.
- The tldraw Cloudflare sync reference uses the same storage split proposed here for live items: a Durable Object per collaborative room persists room state in SQLite, while static uploaded images/videos bypass the room DO and live in R2. The collaborative document stores URL/pointer records for those R2 assets.

Primary references:

- Cloudflare Durable Objects overview: https://developers.cloudflare.com/durable-objects/
- Durable Object SQLite storage: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- Durable Object limits: https://developers.cloudflare.com/durable-objects/platform/limits/
- Durable Object WebSockets: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Durable Object data location: https://developers.cloudflare.com/durable-objects/reference/data-location/
- Cloudflare Agents state: https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/
- Cloudflare Agents sub-agents: https://developers.cloudflare.com/agents/api-reference/sub-agents/
- Cloudflare Agent tools: https://developers.cloudflare.com/agents/api-reference/agent-tools/
- R2 consistency: https://developers.cloudflare.com/r2/reference/consistency/
- AI Search metadata: https://developers.cloudflare.com/ai-search/configuration/metadata/
- AI Search per-tenant search: https://developers.cloudflare.com/ai-search/how-to/per-tenant-search/
- tldraw Cloudflare sync example: https://github.com/tldraw/tldraw-sync-cloudflare
- Local tldraw reference clone: `references/tldraw-sync-cloudflare`

## Current Architecture Baseline

The current codebase is Postgres-first:

```txt
Postgres
  workspaces
  workspace_members
  workspace_items
  content_snapshots
  item_assets
  workspace_item_search
  workspace_events
  workspace_item_user_state

Durable Objects / PartyServer
  workspace realtime presence and committed item event fanout

Cloudflare Agents
  workspace chat directory and chat threads

R2
  planned private asset storage
```

Important current implementation anchors:

- `WorkspaceRoom` is a PartyServer/Durable Object room for presence and workspace event fanout.
- `WorkspaceChatDirectory` is an Agent with SQLite state for chat thread metadata.
- `WorkspaceChatAgent` is a Think-based chat agent. It currently reads workspace items by opening a DB context and querying Postgres.
- Chat routing is user-scoped: `/workspace-chat` authenticates the Better Auth session, then routes to `WorkspaceChatDirectory` named by `session.user.id`.
- The UI connects to `WorkspaceChatDirectory` and targets a thread with `sub: [{ agent: "WorkspaceChatAgent", name: threadId }]`.
- `WorkspaceChatDirectory` owns user chat UX state such as thread title, running status, unread state, last viewed time, and archived/deleted thread membership.
- The current architecture explicitly says Postgres owns durable workspace state, while Durable Objects coordinate realtime connections.

This draft changes that center of gravity for the workspace body only. It does not imply removing relational storage for users, organizations, billing, workspace directory records, or global product metadata.

## Target Architecture

```txt
React UI
  TanStack Router routes
  TanStack Query cache
  filesystem-like workspace client
  viewer/editor registry

TanStack Start / Worker entry
  auth boundary
  central account/org APIs
  routes requests to WorkspaceAgent/WorkspaceDO
  upload/download authorization routes

Central Postgres or D1
  users and auth-related app ids
  organizations
  workspace directory
  workspace membership
  billing and plan limits
  global audit summaries
  cross-workspace index bookkeeping

WorkspaceAgent / WorkspaceDO
  canonical workspace tree
  item metadata
  folders
  lightweight native content
  current snapshot pointers
  asset pointers
  command log and workspace events
  local search manifest
  presence and websocket fanout
  workspace-scoped AI memory
  lifecycle for item sub-agents

ItemAgent / ItemDO
  live collaboration for open high-frequency items
  Tiptap/Yjs document sessions
  whiteboard sessions
  code/text editing sessions
  periodic durable checkpoints

R2
  uploaded PDFs, audio, images, text/code originals
  large authored snapshots
  generated exports and derivatives
  sandbox artifacts

Workflows / Queues
  extraction
  transcription
  OCR
  indexing
  generated derivatives
  long-running human-in-the-loop operations

AI Search / Vectorize / custom index
  derived retrieval layer
  workspace and item metadata filters
  permission-filtered cross-workspace memory
```

## Source Of Truth Split

### Central Database

The central database should remain authoritative for data that naturally crosses workspaces:

- user identity references owned by the app
- organizations and teams
- workspace directory rows
- workspace membership and roles
- plan limits, billing, quotas, and abuse controls
- global audit summaries
- cross-workspace search/index bookkeeping
- possibly workspace export/import job records

The central database should not own the full item tree or content body in the actor-first target.

### WorkspaceAgent / WorkspaceDO

The workspace actor should become authoritative for data that belongs inside one workspace:

- folders and item tree
- item names, types, ordering, colors, lightweight metadata
- content snapshot metadata and current pointers
- small authored content bodies under storage limits
- R2 asset pointers
- workspace command log
- workspace-local events
- workspace-local search text/projections
- workspace-level presence
- workspace-level AI memory

The workspace actor should expose methods, not raw storage. The UI and AI both go through the same command API.

### R2

R2 owns bytes that do not belong in Durable Object SQLite:

- PDFs
- audio
- images
- video when enabled
- Office files when enabled
- large text/code files
- large document snapshots
- generated exports
- derived artifacts

The workspace actor stores pointers, hashes, sizes, MIME information, and current snapshot references.

The tldraw reference is the practical precedent for this split:

```txt
tldraw room DO
  collaborative room state in DO SQLite

tldraw R2 bucket
  uploaded image/video bytes

tldraw document records
  asset URL/pointer stored in the collaborative room state
```

Thinkex should use the same idea with stricter product rules:

```txt
WorkspaceAgent SQLite
  item row
  asset row
  r2Key
  mimeType
  sizeBytes
  checksum/etag
  current snapshot pointer

R2
  PDF/audio/image/text bytes
  large snapshot bodies
  generated artifacts
```

Unlike the public tldraw sample, Thinkex asset routes must enforce workspace membership, private reads, server-side file classification, allowed MIME/family policy, content security headers, and short-lived signed access or authorization-aware streaming.

## Workspace API Shape

The durable API should feel like a safe filesystem plus object registry:

```ts
workspace.getSummary()
workspace.listItems({ parentId })
workspace.getItem({ itemId })
workspace.readContent({ itemId, representation })
workspace.createItem({ parentId, type, name, initialContent })
workspace.renameItem({ itemId, name })
workspace.moveItem({ itemId, parentId, sortOrder })
workspace.deleteItem({ itemId })
workspace.writeSnapshot({ itemId, format, content, reason })
workspace.createDerivative({ sourceItemId, type, content, provenance })
workspace.attachAsset({ itemId, r2Key, filename, mimeType, sizeBytes, checksum })
workspace.searchLocal({ query, filters })
workspace.getAiReadableContext({ itemIds, query, budget })
workspace.recordUserState({ itemId, state })
```

Rules:

- Every write is a command.
- Every command validates membership and role.
- Every command validates the object registry capability for the target item.
- Every command creates a durable event.
- Every event can update local state, broadcast realtime messages, and enqueue derived work.
- AI writes use the same command API as user writes. AI must not mutate SQLite tables directly.

## Item Storage Model

### Folder

```txt
WorkspaceAgent SQLite
  item row
  parentId
  sortOrder
  metadata
```

### Document

```txt
Small document
  item row in WorkspaceAgent SQLite
  snapshot metadata in SQLite
  Tiptap JSON and text projection inline if under size limits

Large document
  item row in WorkspaceAgent SQLite
  snapshot metadata in SQLite
  content body in R2
  current snapshot points to R2 key

Live collaboration
  optional DocumentItemAgent while document is open
  Yjs/Tiptap updates flow through item actor
  checkpoint snapshots back to WorkspaceAgent/R2
```

### PDF

```txt
WorkspaceAgent SQLite
  item row
  asset pointer
  extraction status
  current extracted snapshot pointer

R2
  original PDF
  extracted text if large
  page images/thumbnails if generated

Derived index
  text chunks and embeddings
```

### Audio

```txt
WorkspaceAgent SQLite
  item row
  asset pointer
  transcript status
  current transcript snapshot pointer

R2
  original audio
  transcript JSON if large

Derived index
  transcript chunks and embeddings
```

### Flashcards And Quizzes

```txt
Normal deck/quiz
  item row in WorkspaceAgent SQLite
  structured JSON snapshot inline if under size limits
  text projection for search and AI

Large deck/quiz
  item row and snapshot metadata in SQLite
  structured body in R2
```

### Whiteboard And Board

```txt
WorkspaceAgent SQLite
  item row
  current snapshot pointer
  local metadata

ItemAgent
  live collaborative room while open
  high-frequency updates
  periodic checkpoint snapshots

R2
  large snapshots or embedded media
```

## Parent And Item Actors

The preferred first model is normal named actor classes:

```txt
WorkspaceAgent(workspaceId)
  parent actor and canonical workspace body

DocumentItemAgent(workspaceId:itemId)
  live document collaboration

WhiteboardItemAgent(workspaceId:itemId)
  live whiteboard collaboration
```

Cloudflare Agent sub-agents are also promising:

```txt
WorkspaceAgent(workspaceId)
  subAgent(DocumentItemAgent, itemId)
  subAgent(WhiteboardItemAgent, itemId)
```

Sub-agents match the desired ownership model because the parent can coordinate discovery, access control, and lifecycle while children get isolated SQLite storage and typed RPC.

Open question: whether item actors should be ordinary top-level Durable Object namespaces or Agent sub-agents. Sub-agents are a stronger conceptual fit, but we need a small prototype before depending on them for all item collaboration.

## Chat Actors Versus Workspace Actors

The current chat actor topology should not be collapsed into the workspace actor by default.

Current topology:

```txt
WorkspaceChatDirectory(userId)
  user-scoped Agent/DO
  stores chat thread metadata in SQLite
  creates WorkspaceChatAgent(threadId) sub-agents

WorkspaceChatAgent(threadId)
  thread-scoped Think agent
  stores and streams chat runtime state
  gets workspaceId from parent directory
  currently reads workspace facts from Postgres tools
```

Target topology:

```txt
WorkspaceChatDirectory(userId)
  stays user-scoped
  owns user's thread list, unread state, viewed state, and private chat UX

WorkspaceChatAgent(threadId)
  stays thread-scoped
  calls WorkspaceAgent(workspaceId) for workspace reads/writes

WorkspaceAgent(workspaceId)
  workspace-scoped source of truth
  owns the workspace body, command log, events, local memory, and item actor lifecycle

ItemAgent(workspaceId:itemId)
  item-scoped live collaboration where needed
```

This keeps ownership clean:

- user chat directory state remains private/user-scoped
- workspace filesystem state remains shared/workspace-scoped
- chat threads bridge to the workspace through typed tools
- shared workspace chats can be added later if the product needs them

The first migration step for AI tools is therefore not to move chat under `WorkspaceAgent`. It is to change the `WorkspaceChatAgent` tools from direct Postgres reads to workspace command/API calls:

```txt
today:
  WorkspaceChatAgent -> createDbContext -> listWorkspaceItemsForWorkspace

target:
  WorkspaceChatAgent -> WorkspaceAgent(workspaceId).listItems/readContent/search/writeSnapshot
```

## Realtime Collaboration

The root workspace actor should own low-frequency collaboration:

- presence
- active users
- file tree changes
- item created/renamed/moved/deleted
- workspace command feed
- AI activity status
- notifications that a snapshot changed

High-frequency collaboration should move to item actors:

- Tiptap/Yjs document editing
- whiteboard strokes and shape updates
- code/text collaborative editing
- cursor/selection state

The workspace actor should not become the long-term pipe for every keystroke in every item. It should hold the durable manifest and broadcast committed facts. Item actors should handle open-item realtime sessions and checkpoint meaningful state back to the workspace.

The tldraw reference demonstrates this item-level model for whiteboards:

```txt
Worker route /api/connect/:roomId
  routes to one room Durable Object by roomId

TldrawDurableObject(roomId)
  owns websocket hibernation
  uses TLSocketRoom for collaboration
  persists room state through SQLiteSyncStorage
  serializes socket session snapshots for hibernation resume

R2 upload/download routes
  store large media assets outside the room DO
  return asset URLs that the room state can reference
```

Thinkex should adapt this as an `ItemAgent` pattern, not as the root workspace pattern. The root workspace actor should know that an item exists and what its current checkpoint is; the item actor should own the bursty open-editor collaboration session.

## AI Integration

The current `WorkspaceChatAgent` reads workspace items from Postgres. In the actor-first model, workspace chat should read through the workspace actor.

```txt
WorkspaceChatAgent
  get thread/chat state from Agent storage
  call WorkspaceAgent tools for workspace reads/writes
  propose or execute commands depending on approval policy

WorkspaceAgent
  enforce permissions
  enforce registry capabilities
  mutate workspace state
  write events
  broadcast changes
  enqueue derived work
```

Potential tools:

```txt
listItems
readItem
readAiContext
searchWorkspace
createDocument
createFlashcards
createQuiz
summarizeItem
moveItem
renameItem
createDerivative
requestExtraction
```

AI write policy should be explicit:

- safe reads can execute directly after authorization
- low-risk creations may execute directly if the user requested them
- destructive edits, source overwrites, deletes, and bulk operations should require approval
- generated outputs should usually be derivatives or new snapshots, not silent source rewrites

Tool calls should carry enough identity for the workspace actor to enforce and audit the action:

```txt
workspaceId
userId
agentSessionId or threadId
requested capability
itemId, parentId, or query
representation and budget
```

The workspace actor, not the chat agent, should decide whether an item is AI-readable or AI-editable. For example:

```txt
PDF
  AI receives extracted text/chunks if extraction exists
  otherwise receives metadata and a "needs extraction" status

Audio
  AI receives transcript/chunks if transcription exists

Tiptap document
  AI receives markdown/plain-text projection, not arbitrary editor internals unless requested by a specific edit tool

Flashcards / quiz
  AI receives validated structured JSON plus a text projection
```

## Cross-Workspace AI Memory

Users rarely need manual cross-workspace queries, but the AI may need opt-in cross-workspace memory.

This should be derived, not canonical:

```txt
WorkspaceAgent
  publishes compact workspace memory cards
  publishes item chunks or summaries after indexing

Central index
  stores workspaceId, itemId, chunkId, permission metadata, freshness marker

AI agent
  asks central index for candidate memories
  filters by user/agent permission
  calls relevant WorkspaceAgents for deeper authorized context
```

Two possible designs:

1. Shared AI Search instance with tenant/workspace metadata filters.
2. Custom Vectorize or Postgres/pgvector index if Thinkex needs more control over chunking, permissions, ranking, freshness, or deletion.

AI Search looks promising for early derived retrieval, but we need to validate permission filtering, deletion semantics, freshness, cost, and whether the managed model is flexible enough.

## Runtime And Plugin Boundary

The actor-first workspace architecture does not require Workers for Platforms.

Workers for Platforms is a future candidate only if Thinkex becomes a programmable platform that runs untrusted user-authored or AI-authored Worker code. The core workspace should be first-party Thinkex code running in controlled actors and Workflows.

Use first:

```txt
WorkspaceAgent
  first-party workspace filesystem and command authority

ItemAgent
  first-party item collaboration runtime

Workflows / Queues
  first-party async jobs

Sandbox SDK / Containers
  future controlled execution for heavier code, tests, imports, and data processing
```

Use Workers for Platforms later only for:

- user-created plugins that execute arbitrary code
- AI-generated hosted mini-apps with their own URL
- per-customer programmable workflows outside the fixed Thinkex command model
- sandboxed code that needs Worker bindings and platform-level isolation

Workers for Platforms should not own canonical workspace data. If introduced, platform Workers should call the same workspace command API as the UI and AI agents, with strict bindings, quotas, and permission checks.

## Migration Plan

### Phase 0: Keep Current Postgres Model, Add Workspace API Boundary

Create a `workspaceFs` or `workspaceKernel` server module over the existing Postgres tables.

Goals:

- UI and AI stop calling raw workspace query helpers for product operations.
- Commands become explicit and registry-aware.
- Events are written consistently.
- The future actor API shape is tested while Postgres remains canonical.

### Phase 1: Workspace Actor Mirror

Add a `WorkspaceAgent` that mirrors one workspace from Postgres.

Responsibilities:

- load workspace manifest from Postgres
- serve read-only filesystem APIs
- broadcast presence and workspace events
- expose AI tools through actor methods
- compare actor responses against existing Postgres queries in development

Postgres remains canonical.

### Phase 2: Actor-Owned New Workspaces

Create new workspaces in actor-first mode behind a feature flag.

Responsibilities move:

- item tree writes go to `WorkspaceAgent`
- content snapshot metadata goes to `WorkspaceAgent`
- large assets go to R2
- central Postgres keeps workspace directory and membership
- derived search/index jobs subscribe to workspace events

Legacy workspaces remain Postgres-first until migration.

### Phase 3: Item Actors For Live Collaboration

Introduce item actors only for item types that need high-frequency collaboration.

Initial candidates:

- document editor
- whiteboard
- code/text editor if collaborative editing is enabled

Do not create item actors for passive PDFs, images, or audio playback unless a workflow proves it needs one.

### Phase 4: Cross-Workspace Memory

Publish derived memory from workspace actors to a central retrieval layer.

Start with:

- workspace summary
- item title/path/type
- extracted text chunks
- authored text chunks
- generated summaries
- permission metadata

Do not let the central index become source of truth.

### Phase 5: Migrate Existing Postgres Workspaces

Migration should be explicit and reversible during the transition:

1. Freeze or queue writes for one workspace.
2. Export Postgres workspace rows into an actor import bundle.
3. Create or hydrate `WorkspaceAgent(workspaceId)`.
4. Verify item count, paths, snapshot pointers, assets, and events.
5. Switch workspace directory mode from `postgres` to `actor`.
6. Keep old Postgres rows read-only until retention period expires.
7. Delete old rows only after export, backups, and rollback path are proven.

## Postgres Interaction In The Target

Postgres can remain in the system but with narrower responsibility.

Potential central tables:

```txt
users
organizations
organization_members
workspace_directory
workspace_members
workspace_member_invites
workspace_actor_locations
workspace_index_state
workspace_export_jobs
billing_accounts
audit_summaries
```

Potential `workspace_directory` shape:

```txt
id
ownerOrgId
name
icon
color
description
storageMode        // postgres | actor
actorName
locationHint
jurisdiction
itemCountEstimate
lastActivityAt
createdAt
updatedAt
archivedAt
```

Potential `workspace_members` stays central because route guards, home pages, invites, and billing need cross-workspace reads.

## Data Location

Durable Objects do not currently relocate automatically after creation. The initial workspace actor location matters.

Open design:

- choose location hint from owner/org region at workspace creation
- support jurisdiction-restricted namespaces where required
- store location/jurisdiction in the workspace directory
- do not assume moving a workspace actor between regions is easy

## Observability And Repair

Actor-first storage requires extra operational tooling that Postgres currently gives almost for free.

Needed before production migration:

- inspect workspace actor manifest
- export workspace actor to portable JSON/R2 bundle
- import workspace actor from bundle
- run integrity checks
- list actor events
- rebuild local search manifest
- rebuild central search/memory index
- compare actor manifest against legacy Postgres during migration
- recover via DO point-in-time recovery where appropriate

This is a real cost of the actor-first model.

## Risks

- Migrations across many actor-local SQLite databases are harder than one Postgres schema.
- Debugging and repair require custom tools.
- Cross-workspace product analytics and admin views become derived or central-summary based.
- A single busy workspace actor can become a hotspot.
- Large content must spill to R2 because of DO row limits.
- In-memory DO state is not durable across hibernation or restart.
- AI writes can become dangerous unless forced through a validated command API.
- Vendor lock-in increases because workspace state lives in Cloudflare actors.
- Local development and testing must faithfully emulate Workers, Agents, R2, and DO storage.

## Assumptions

- Most workspaces stay under 1,000 visible items.
- Large PDFs, audio files, images, and future video live in R2.
- Workspace-level permissions are enough for the first actor-first version.
- Users mainly work inside one workspace at a time.
- Cross-workspace AI is useful but can be served by derived memory and retrieval.
- Live collaboration starts with a small number of item types.
- Postgres can remain for account, org, membership, and directory data.
- Cloudflare Agents sub-agents are stable enough to prototype parent-child item actors, but not yet proven enough to make them the only design option.

## Open Questions

1. Should the root workspace actor be a plain Durable Object, an Agent, or an Agent subclass that also exposes non-chat RPC?
2. Should item actors be normal named Durable Objects or Agent sub-agents under the workspace actor?
3. Should chat threads remain under `WorkspaceChatDirectory`, move under `WorkspaceAgent`, or become sub-agents of the workspace?
4. Should workspace membership stay only in the central database, or should the workspace actor cache membership for low-latency checks?
5. What is the exact approval policy for AI writes?
6. What is the minimum export format for a self-contained workspace bundle?
7. What should be inline in actor SQLite versus stored as R2-backed snapshot body?
8. How should actor schema migrations run across many workspaces?
9. What is the recovery story if an actor import partially succeeds?
10. How much local search should live inside `WorkspaceAgent` before using AI Search or Vectorize?
11. Can AI Search satisfy Thinkex permission filtering and deletion requirements, or do we need a custom retrieval index?
12. What data location and jurisdiction choices should be exposed to users or org admins?
13. Should the current Postgres workspace tables remain indefinitely as a compatibility/read model, or be fully retired for actor-mode workspaces?
14. How should billing and quotas account for per-workspace DO storage, R2 bytes, indexing rows, and AI usage?
15. How should tests create, reset, inspect, and migrate actor-backed workspaces?

## Near-Term Recommendation

Do not rewrite the current workspace storage immediately.

First, introduce a workspace command/API boundary that works against the current Postgres tables. Then prototype a read-only `WorkspaceAgent` mirror and a single item actor for one collaborative item type.

If the prototype proves that:

- the UI can load workspace state through actor APIs,
- the AI can read and write through the same command surface,
- R2 snapshot spillover is ergonomic,
- item actors handle live collaboration cleanly,
- migrations and inspection tooling are tractable,

then new workspaces can move to actor-first mode behind a feature flag while existing Postgres workspaces remain stable.

## Prototype Spikes

Before changing the canonical data model, run small implementation spikes:

1. Workspace API boundary on Postgres
   - Implement `listItems`, `getItem`, `createItem`, `moveItem`, and `writeSnapshot` through one command module.
   - Make the current AI chat tool call this module instead of direct query helpers.

2. Read-only `WorkspaceAgent` mirror
   - Hydrate an actor from an existing Postgres workspace.
   - Compare actor item tree output with the current route loader output.
   - Add a development-only integrity check.

3. Single item actor
   - Pick either a simple text document or tldraw-style whiteboard.
   - Keep item metadata in the workspace layer.
   - Route high-frequency collaboration to the item actor.
   - Persist checkpoints back through the workspace command API.

4. R2 snapshot spillover
   - Store small content inline and large content in R2 behind the same `readContent` API.
   - Verify AI reads do not care where the content body lives.

5. Cross-workspace memory sketch
   - Publish two or three summary records from each workspace.
   - Query them with permission metadata.
   - Fetch deeper context from the source workspace actor only after authorization.
