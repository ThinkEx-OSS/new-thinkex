# Thinkex Workspace Kernel Architecture Draft

## Status

This is a research draft for migrating the current Postgres-first workspace architecture toward a workspace-kernel model built around Cloudflare Durable Objects and Agents.

The existing architecture in `docs/ARCHITECTURE.md` describes the app before the kernel migration. This document is the working target for the kernel migration and assumes the app is early enough to reset development workspace data instead of preserving legacy workspace-body compatibility.

## Product Thesis

Thinkex workspaces are closer to user-facing filesystems than generic database apps. Users organize study, research, and business operations inside a bounded workspace. They usually operate in one workspace at a time. Later, AI can add controlled cross-workspace memory and retrieval without changing the workspace source of truth.

That product shape makes a workspace kernel plausible:

```txt
Workspace
  a durable, collaborative, AI-readable filesystem-like world

Workspace kernel
  the authority for tree state, item metadata, commands, local events, human presence, and coarse event fanout

Document sessions
  optional high-frequency collaboration runtimes for open documents, code files, and later whiteboards

AI threads
  a native participant that reads and writes through the same command surface as users
```

The target user experience should still be non-technical. Users see folders, tabs, editors, viewers, flashcards, quizzes, search, and AI. The kernel/filesystem model is an internal architecture, not a developer-facing abstraction exposed to normal users.

## Research Snapshot

This draft is based on the current repo plus Cloudflare documentation checked on 2026-05-26.

Relevant Cloudflare findings:

- Durable Objects are intended for coordinated stateful applications such as collaborative editing, chat rooms, multiplayer, and live notifications.
- SQLite-backed Durable Objects provide strongly consistent transactional storage that is private to one object instance.
- SQLite-backed Durable Objects on Workers Paid have a 10 GB per-object storage limit, a 2 MB max row/string/BLOB size, and an individual-object soft throughput guideline around 1,000 requests per second.
- Durable Objects can use WebSocket hibernation so clients stay connected while in-memory state is reset. Durable state must be persisted, not kept only in class fields.
- Cloudflare's Durable Object WebSocket docs recommend hibernation for cost-sensitive realtime rooms: one DO can coordinate a room, clients can remain connected while the object sleeps, and connection state should be restored through serialized attachments or persisted storage.
- R2 is strongly consistent for object write/read/delete/list and metadata updates, making it suitable for large workspace assets and snapshot bodies.
- Cloudflare Agents provide persisted state, SQL access, WebSocket state sync, callable RPC, broadcast helpers, and sub-agents on top of Durable Objects.
- The Agents client SDK provides `useAgent`, `AgentClient`, and `agentFetch`. Use the WebSocket clients for realtime state/RPC/reconnect behavior, and `agentFetch` only for one-off request/response calls.
- Agent state sync is useful for compact JSON state shared with connected clients, but it should not be treated as the full workspace filesystem or the high-frequency editor collaboration log.
- Agent readonly connections can map naturally to viewer/spectator roles, but they only protect Agent state/RPC writes. Thinkex still needs server-side membership and command validation.
- Agents queue, schedule, and durable fiber APIs are useful for local background work owned by a kernel or AI thread. Cloudflare Workflows are the better fit for longer multi-step jobs with retries, sleeps, and external approvals.
- Agent sub-agents are co-located child Durable Objects with isolated SQLite storage and typed parent-child RPC. This is close to a workspace parent with item children.
- Project Think introduces an execution ladder: durable workspace filesystem, sandboxed JavaScript in Dynamic Workers, npm-enabled Dynamic Workers, browser automation, and finally full Linux sandboxes.
- `@cloudflare/shell` is the durable workspace filesystem layer in that ladder. It exposes a filesystem API backed by SQL with optional R2 spillover for large files. Thinkex should use its Durable Object SQLite path as the workspace storage base.
- `@cloudflare/shell` is explicitly experimental. It is not a bash interpreter; it runs sandboxed JavaScript against typed `state.*` filesystem operations.
- `@cloudflare/think` auto-wires a per-agent virtual workspace backed by Durable Object SQLite, plus workspace tools, message persistence, stream resumption, client tools, extensions, and tool-call hooks.
- `@cloudflare/think/tools/workspace` can expose filesystem-style AI tools over any compatible workspace: read, write, edit, list, find, grep, and delete.
- `@cloudflare/think/tools/execute` creates a sandboxed JavaScript execution tool that lets the model write code against typed tools and optional filesystem state. This is useful for multi-step workspace automation, but it is not bash.
- `@cloudflare/ai-chat` provides lower-level chat plumbing: persisted messages, resumable WebSocket streaming, server tools, client tools, and human-in-the-loop tool approvals. Think builds a more opinionated agent loop on top of the same general stack.
- The installed `@cloudflare/think@0.7.2` exports `createSandboxTools`, but its type docs say it is not implemented yet and currently returns an empty `ToolSet`. Do not depend on it for real Linux execution.
- Cloudflare Sandbox SDK is the separate product for real Linux/container execution: shell commands, Python/Node, package installs, Git, background processes, browser terminals, preview URLs, R2/S3 bucket mounts, and backups/restores.
- AI Search supports metadata filtering and per-tenant patterns, which may support derived cross-workspace retrieval if permission metadata is modeled carefully.
- Durable Objects support jurisdiction restrictions and location hints, but currently do not dynamically move existing objects after creation.
- The current Thinkex user-AI implementation uses the target parent/sub-agent shape: one `UserAIStore` Agent per user and one `AIThread` sub-agent per thread.
- The tldraw Cloudflare sync reference uses the same storage split proposed here for live items: a Durable Object per collaborative room persists room state in SQLite, while static uploaded images/videos bypass the room DO and live in R2. The collaborative document stores URL/pointer records for those R2 assets.
- Hocuspocus v4 now documents Cloudflare Workers support. It is a plausible later Tiptap/Yjs `DocumentSession` option, but it does not remove the need for the root workspace kernel, command log, or snapshot/checkpoint boundary.
- Yjs remains the likely CRDT layer for rich text/code collaboration because it separates editor bindings from providers and supports awareness/offline patterns. It should live at item-session scope, not root-workspace scope.

Primary references:

- Cloudflare Durable Objects overview: https://developers.cloudflare.com/durable-objects/
- Durable Object SQLite storage: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- Durable Object limits: https://developers.cloudflare.com/durable-objects/platform/limits/
- Durable Object WebSockets: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Durable Object data location: https://developers.cloudflare.com/durable-objects/reference/data-location/
- Cloudflare Agents state: https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/
- Cloudflare Agents client SDK: https://developers.cloudflare.com/agents/api-reference/client-sdk/
- Cloudflare Agents callable methods: https://developers.cloudflare.com/agents/api-reference/callable-methods/
- Cloudflare Agents readonly connections: https://developers.cloudflare.com/agents/api-reference/readonly-connections/
- Cloudflare Agents queue tasks: https://developers.cloudflare.com/agents/api-reference/queue-tasks/
- Cloudflare Agents schedule tasks: https://developers.cloudflare.com/agents/api-reference/schedule-tasks/
- Cloudflare Agents durable execution: https://developers.cloudflare.com/agents/api-reference/durable-execution/
- Cloudflare Agents sub-agents: https://developers.cloudflare.com/agents/api-reference/sub-agents/
- Cloudflare Agent tools: https://developers.cloudflare.com/agents/api-reference/agent-tools/
- Cloudflare Think API: https://developers.cloudflare.com/agents/api-reference/think/
- Cloudflare Workflows: https://developers.cloudflare.com/workflows/
- Project Think announcement: https://blog.cloudflare.com/project-think/
- Cloudflare Sandbox SDK: https://developers.cloudflare.com/sandbox/
- Cloudflare Sandbox commands: https://developers.cloudflare.com/sandbox/api/commands/
- Cloudflare Sandbox OpenAI Agents tutorial: https://developers.cloudflare.com/sandbox/tutorials/openai-agents/
- R2 consistency: https://developers.cloudflare.com/r2/reference/consistency/
- AI Search metadata: https://developers.cloudflare.com/ai-search/configuration/metadata/
- AI Search per-tenant search: https://developers.cloudflare.com/ai-search/how-to/per-tenant-search/
- tldraw Cloudflare sync example: https://github.com/tldraw/tldraw-sync-cloudflare
- tldraw sync docs: https://tldraw.dev/docs/sync
- Hocuspocus docs: https://tiptap.dev/docs/hocuspocus
- Yjs collaborative editor guide: https://docs.yjs.dev/getting-started/a-collaborative-editor
- Local tldraw reference clone: `references/tldraw-sync-cloudflare`
- Local package evidence:
  - `node_modules/@cloudflare/shell/dist/filesystem-BKxpZmkl.d.ts`
  - `node_modules/@cloudflare/shell/README.md`
  - `node_modules/@cloudflare/think/README.md`
  - `node_modules/@cloudflare/ai-chat/README.md`
  - `node_modules/@cloudflare/think/dist/tools/workspace.d.ts`
  - `node_modules/@cloudflare/think/dist/tools/execute.d.ts`
  - `node_modules/@cloudflare/think/dist/tools/sandbox.d.ts`

## Current Implementation Baseline

After the first foundation cleanup, the current codebase is intentionally between the old Postgres workspace-body model and the new kernel model:

```txt
Postgres
  workspaces
  workspace_members
  users/auth tables

Cloudflare Agents
  workspace kernel
  user AI store and AI threads

R2
  planned private asset storage after kernel wiring
```

Important current implementation anchors:

- `WorkspaceKernel` now exists as an Agent-backed Durable Object with a shell-backed item registry and first create/read/write/rename/move/delete commands.
- `WorkspaceKernel` also owns lightweight workspace presence and coarse workspace event fanout over WebSockets.
- `UserAIStore` is an Agent with SQLite state for private user AI thread metadata.
- `AIThread` is a Think-based chat agent. It reads workspace facts through `workspace-kernel-access`.
- User AI routing is user-scoped: `/user-ai` authenticates the Better Auth session, then routes to `UserAIStore` named by `session.user.id`.
- The UI connects to `UserAIStore` and targets a thread with `sub: [{ agent: "AIThread", name: threadId }]`.
- `UserAIStore` owns user AI UX state such as thread title, running status, unread state, last viewed time, and archived/deleted thread membership.
- Postgres no longer owns the workspace item tree, snapshots, assets, search rows, item events, or per-item user state.
- The current workspace realtime bridge broadcasts coarse events but does not yet persist kernel events, assign revisions, or patch TanStack Query caches from a shared event applier.

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
  routes requests to WorkspaceKernel
  upload/download authorization routes

Central Postgres
  users and auth-related app ids
  organizations
  workspace directory
  workspace membership
  billing and plan limits
  global audit summaries
  cross-workspace index bookkeeping

WorkspaceKernel
  canonical workspace tree
  extends Cloudflare Agent
  not an autonomous AI assistant
  wraps @cloudflare/shell Workspace as the low-level filesystem
  item metadata
  folders
  lightweight native content
  current snapshot pointers
  asset pointers
  command log and workspace events
  local search manifest
  command/event emission
  hibernatable websocket presence
  coarse workspace event broadcast
  workspace-local AI-readable projections
  lifecycle for document/session sub-agents

DocumentSession
  live collaboration for open high-frequency items
  Tiptap/Yjs document sessions
  code/text editing sessions
  periodic durable checkpoints

R2
  uploaded PDFs, audio, images, text/code originals
  large authored snapshots
  generated exports and derivatives
  sandbox artifacts

Dynamic Worker Execute
  optional sandboxed JavaScript for multi-step AI automation over typed tools
  no ambient network by default
  not a Linux shell

Cloudflare Sandbox SDK
  optional full Linux/container execution for bash, git, package installs, tests, and generated apps
  per-task or per-session sandboxes
  sync selected workspace files in and approved outputs back out

Workflows / Queues
  extraction
  transcription
  OCR
  indexing
  generated derivatives
  long-running human-in-the-loop operations

AI Search / Vectorize / custom index
  future derived retrieval layer
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

The central database should not own the full item tree or content body in the kernel-first target.

### WorkspaceKernel

The workspace kernel should become authoritative for data that belongs inside one workspace:

- `@cloudflare/shell` workspace files and directories
- folders and item tree
- item names, types, ordering, colors, lightweight metadata
- content snapshot metadata and current pointers
- small authored content bodies under storage limits
- R2 asset pointers
- workspace command log
- workspace-local events
- workspace-local search text/projections
- workspace event emission
- lightweight workspace presence
- coarse websocket event fanout
- workspace-local AI-readable projections

The workspace kernel should expose methods, not raw storage. The UI and AI both go through the same command API.

Presence and coarse websocket fanout should live in `WorkspaceKernel` for the early-stage architecture. Cloudflare Agents already provide the Durable Object/WebSocket room mechanics, so a separate workspace room adds coordination cost before the product needs it. The product boundary remains the same: commands mutate kernel state, and kernel websocket messages notify open clients.

The first implementation should test whether `@cloudflare/shell` can carry the low-level filesystem responsibilities directly. The kernel should add Thinkex product semantics around it:

```txt
@cloudflare/shell Workspace
  durable file paths
  directories
  read/write/list/glob/stat/rm
  text search/replace/diff via state backend
  R2 spillover for large files

WorkspaceKernel
  auth and membership checks
  product item registry
  object type capabilities
  command/event log
  UI-specific metadata
  AI approval policy
  document session lifecycle
  sandbox sync boundaries
```

This avoids reimplementing a filesystem table layout before we know where Cloudflare's package boundaries are. If `@cloudflare/shell` is too limiting, the fallback is still a custom kernel schema on DO SQLite plus R2, but that should be learned from a spike rather than assumed upfront.

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

The workspace kernel stores pointers, hashes, sizes, MIME information, and current snapshot references.

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
@cloudflare/shell Workspace inside WorkspaceKernel
  file/directory record
  optional R2 spillover for large file bytes

WorkspaceKernel product registry
  path or item id
  item type/family
  UI metadata
  r2Key/mimeType/sizeBytes/checksum when asset-backed
  current snapshot pointer when snapshot-backed

R2
  PDF/audio/image/text bytes
  large snapshot bodies
  generated artifacts
```

Unlike the public tldraw sample, Thinkex asset routes must enforce workspace membership, private reads, server-side file classification, allowed MIME/family policy, content security headers, and short-lived signed access or authorization-aware streaming.

## Cloudflare Shell Workspace Layer

`@cloudflare/shell` is the closest Cloudflare primitive to the "workspace as filesystem" idea. It is not a user-visible terminal and it is not Linux bash. It is a durable virtual filesystem API.

The installed package exposes a `Workspace` that can be backed by Durable Object SQLite storage and optional R2:

```ts
new Workspace({
  sql: this.ctx.storage.sql,
  r2: this.env.WORKSPACE_BUCKET,
  r2Prefix: `workspaces/${workspaceId}`,
  name: () => workspaceId,
})
```

Important package details from the installed types:

- `sql` can be Durable Object `SqlStorage`; Thinkex should use that path.
- `r2` is optional and intended for large-file storage.
- `r2Prefix` scopes object keys.
- `inlineThreshold` controls when file bytes spill out of SQL into R2. The package default is documented in types as `1_500_000` bytes.
- `onChange` can report file/directory create, update, and delete events.
- The workspace API includes file operations like read/write bytes, append, exists, stat/lstat, mkdir, readDir, rm, copy, move, symlink/readlink, and glob.
- The state backend adds higher-level AI-friendly operations such as search text, search files, replace in file(s), diff, archive, hash, file detection, edit planning, and edit-plan application.

This gives Thinkex a better starting point than inventing a file table and search/edit helpers from scratch.

Open implementation question: whether our product item registry should store stable item ids that map to shell paths, or whether shell paths should be the primary ids. The conservative first version should keep stable item ids in the kernel registry and map them to paths so rename/move semantics are product-controlled.

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

The API should deliberately be higher-level than raw `@cloudflare/shell` calls. Raw file operations are useful internally and for AI tools, but product commands still need item type validation, permissions, event emission, and UI metadata handling.

Rules:

- Every write is a command.
- Every command validates membership and role.
- Every command validates the object registry capability for the target item.
- Every command creates a durable event.
- Every event can update local state, broadcast realtime messages, and enqueue derived work.
- AI writes use the same command API as user writes. AI must not mutate SQLite tables directly.

## Command, Event, And Cache Foundation

The new research changes the next foundation step: Cloudflare gives Thinkex the durable actor, SQLite storage, websocket transport, Agent RPC, background primitives, and R2/Sandbox integrations. It does not give us an application-level workspace command log, revision protocol, or TanStack Query cache coherence layer.

Thinkex should add that thin layer before building richer editors:

```ts
type WorkspaceCommandResult<T> = {
  result: T;
  event?: WorkspaceEvent;
  revision: number;
};
```

Initial kernel-local tables:

- `kernel_items`: item registry and shell path mapping.
- `kernel_events`: append-only committed workspace events.
- `kernel_meta`: small key-value records such as the current workspace revision.

Potential `kernel_events` shape:

```txt
id
revision
type
actor_user_id
client_mutation_id
payload_json
created_at
```

The kernel command path should own event creation:

```txt
Workspace UI / AI tool
  calls server function or direct kernel tool

Server function
  validates central membership and user role
  calls WorkspaceKernel command

WorkspaceKernel command
  validates local item capability
  mutates kernel_items and/or @cloudflare/shell
  increments revision
  writes kernel_events row
  broadcasts workspace.event
  returns { result, event, revision }
```

This replaces the current temporary pattern where the server mutates the kernel and then separately schedules a broadcast. Separate scheduling is fine as a bridge, but it can drift from the committed write. The durable event should be created in the same kernel turn as the mutation so the websocket broadcast, cache update, and future replay all refer to the same committed fact.

Event payload rules:

- Tree events should contain enough data to patch the cached workspace page without a full refetch: created item summary, renamed item fields, move target/order, deleted item ids.
- Content events should include item id and content revision/version, not full large content.
- Asset events should include pointer metadata, not the bytes.
- Events should include `clientMutationId` so the originating browser can ignore its own optimistic echo.
- Events should be idempotent for cache application. Applying the same event twice should not duplicate items or corrupt ordering.

Client cache rules:

- A single cache adapter should apply workspace events to TanStack Query caches.
- Mutation success and websocket events should call the same adapter.
- Clients should track the last seen workspace revision.
- If the next event revision is contiguous, apply it locally.
- If a revision gap appears after reconnect/hibernation/missed messages, refetch `getPage` first.
- Later, add `getEventsSince(revision)` so reconnects can replay a short event tail before falling back to full page refetch.

Cloudflare primitive mapping:

- Use Durable Object SQLite for the command log and revision counter.
- Use `this.broadcast()` through `WorkspaceKernel` for compact realtime events.
- Use the Agents client SDK for browser connections, reconnects, and optional callable browser RPC.
- Use direct Durable Object RPC for same-Worker server functions and AI tools.
- Use Agent readonly connections for view-only websocket clients when role data is available at connect time.
- Use Agent `queue()` for short kernel-local derived work that can retry.
- Use Agent schedules for workspace-local timers or cleanup.
- Use Agent fibers for recoverable work that belongs inside a single kernel or AI thread.
- Use Workflows for extraction, transcription, OCR, indexing, approvals, and other multi-step jobs that should survive independently of a single Agent turn.

What not to use:

- Do not use Agent `setState` as the full item tree or document body.
- Do not use the AI thread's Think workspace as the shared user workspace.
- Do not use R2 as a queryable workspace database. R2 stores bytes; kernel SQLite stores the manifest and pointers.
- Do not put high-frequency Tiptap/Yjs updates through the root workspace event log. Checkpoint meaningful document/session state back to the kernel.

## AI Execution Ladder

Thinkex should not treat "AI can run commands" as one capability. Cloudflare's current stack suggests a ladder:

### Tier 0: Workspace Filesystem

Use `@cloudflare/shell` through `WorkspaceKernel`.

Capabilities:

- list folders/files
- read/write/edit files
- grep/search
- diff
- apply edit plans
- store large files through R2 spillover

This should be the default for most Thinkex tasks: studying, research, summarization, document edits, flashcard generation, quiz generation, and business-ops workspace changes.

### Tier 1: Sandboxed JavaScript Execute

Use `@cloudflare/think/tools/execute` with a Dynamic Worker loader when we need the model to write a short program that coordinates many tool calls.

Good for:

- scanning many workspace files without many model round trips
- transforming structured workspace data
- generating derived files from existing items
- performing deterministic analysis over text/JSON

Not good for:

- bash
- `npm install`
- Python packages
- native binaries
- long-running dev servers

The execute tool should be capability-scoped. By default, outbound network should stay blocked, and the code should receive only the kernel tools/state we explicitly expose.

### Tier 2: Real Linux Sandbox

Use the separate Cloudflare Sandbox SDK only when a task truly needs a Linux/container environment.

Good for:

- bash commands
- Git operations
- installing packages
- Python/Node data analysis
- running tests/builds
- generated mini-app previews
- browser terminal UI
- long-running background processes

The sandbox should not be the workspace source of truth. It should be per-task or per-session compute:

```txt
AIThread or WorkspaceKernel
  selects allowed files from WorkspaceKernel
  creates or reuses a sandbox
  syncs selected files into /workspace
  runs commands
  collects outputs
  writes approved outputs back through WorkspaceKernel commands
  destroys or idles sandbox
```

This keeps the kernel durable and auditable while still enabling real command execution.

### Tier 3: Browser Automation

Cloudflare Agents and Think also point toward browser tools for web interaction. This is useful later for research workflows, account dashboards, and web extraction, but it should not block the kernel migration.

### Current Package Caveat

`@cloudflare/think/tools/sandbox` is not ready to rely on in this repo. The installed type docs say `createSandboxTools()` is not implemented and returns an empty tool set. Real bash/Linux should be planned against the Cloudflare Sandbox SDK directly, not that Think helper, until the package changes.

## Item Storage Model

### Folder

```txt
WorkspaceKernel SQLite
  item row
  parentId
  sortOrder
  metadata
```

### Document

```txt
Small document
  item row in WorkspaceKernel SQLite
  snapshot metadata in SQLite
  Tiptap JSON and text projection inline if under size limits

Large document
  item row in WorkspaceKernel SQLite
  snapshot metadata in SQLite
  content body in R2
  current snapshot points to R2 key

Live collaboration
  optional DocumentSession while document is open
  Yjs/Tiptap updates flow through the document session
  checkpoint snapshots back to WorkspaceKernel/R2
```

### PDF

```txt
WorkspaceKernel SQLite
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
WorkspaceKernel SQLite
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
  item row in WorkspaceKernel SQLite
  structured JSON snapshot inline if under size limits
  text projection for search and AI

Large deck/quiz
  item row and snapshot metadata in SQLite
  structured body in R2
```

### Whiteboard And Board

```txt
WorkspaceKernel SQLite
  item row
  current snapshot pointer
  local metadata

Future session runtime
  live collaborative room while open
  high-frequency updates
  periodic checkpoint snapshots

R2
  large snapshots or embedded media
```

## Kernel And Document Sessions

The preferred first model is Cloudflare Agent classes named by product responsibility:

```txt
WorkspaceKernel(workspaceId)
  parent Agent and canonical workspace body

DocumentSession(workspaceId:itemId)
  live document collaboration

Future sessions
  live whiteboard collaboration when needed
```

Cloudflare Agent sub-agents are the preferred first shape for document sessions:

```txt
WorkspaceKernel(workspaceId)
  subAgent(DocumentSession, itemId)
```

Sub-agents match the desired ownership model because the parent can coordinate discovery, access control, and lifecycle while children get isolated SQLite storage and typed RPC.

Open question: whether `DocumentSession` should stay an Agent sub-agent or become a plain Durable Object if the chosen editor collaboration library needs lower-level WebSocket control. Sub-agents are the stronger conceptual fit, but we should test the editor before depending on them for all high-frequency collaboration.

## User AI Versus Workspace Kernel

The current user AI topology should not be collapsed into the workspace kernel by default.

Current topology:

```txt
UserAIStore(userId)
  user-scoped Agent/DO
  stores chat thread metadata in SQLite
  creates AIThread(threadId) sub-agents

AIThread(threadId)
  thread-scoped Think/Agent runtime
  stores and streams chat runtime state
  gets workspaceId from parent directory
  currently reads workspace facts through workspace-kernel-access
```

Target topology:

```txt
UserAIStore(userId)
  stays user-scoped
  owns user's thread list, unread state, viewed state, and private chat UX

AIThread(threadId)
  stays thread-scoped
  calls WorkspaceKernel(workspaceId) for workspace reads/writes

WorkspaceKernel(workspaceId)
  workspace-scoped source of truth
  owns the workspace body, command log, events, local projections, and document session lifecycle

DocumentSession(workspaceId:itemId)
  document-scoped live collaboration where needed
```

This keeps ownership clean:

- user chat directory state remains private/user-scoped
- workspace filesystem state remains shared/workspace-scoped
- chat threads bridge to the workspace through typed tools
- shared workspace chats can be added later if the product needs them

The first migration step for AI tools is therefore not to move chat under `WorkspaceKernel`. It is to keep `AIThread` tools behind the workspace-kernel access boundary:

```txt
AIThread -> workspace-kernel-access -> WorkspaceKernel(workspaceId)
```

## Realtime Collaboration

The recommended first runtime split is:

```txt
WorkspaceKernel(workspaceId)
  durable command owner
  mutates item registry and @cloudflare/shell files
  tracks connected human users
  broadcasts presence snapshots
  emits compact workspace events after committed writes

DocumentSession(workspaceId:itemId)
  optional item-level collaboration room for open editors
  handles Yjs/Tiptap or whiteboard burst traffic
  checkpoints durable snapshots back to WorkspaceKernel
```

This maps cleanly to Cloudflare's current docs:

- Durable Objects are the low-level primitive for realtime rooms and websocket hibernation.
- Agents add a higher-level state/RPC/client SDK layer on top of Durable Objects.
- Agent `setState` sync is good for small serializable state, not for every document keystroke or large workspace body data.
- Browser clients should use the Agents client SDK (`useAgent` or `AgentClient`) for Agent websocket connections instead of hand-rolled `WebSocket` or direct `partysocket` usage.
- The Agents client SDK can call `@callable()` methods over websocket or HTTP, but same-Worker code can keep using direct Durable Object RPC.

The root workspace kernel should own low-frequency committed collaboration and lightweight presence:

- file tree changes
- item created/renamed/moved/deleted
- workspace command feed
- AI activity status
- notifications that a snapshot changed
- connected users
- connection status
- coarse active-user display
- websocket reconnect invalidation

High-frequency collaboration should move to document/session runtimes:

- Tiptap/Yjs document editing
- whiteboard strokes and shape updates
- code/text collaborative editing
- cursor/selection state

The workspace kernel should not become the long-term pipe for every keystroke in every item. It should hold the durable manifest and broadcast committed facts. Document sessions handle open-item realtime sessions and checkpoint meaningful state back to the workspace.

Current implementation direction:

- User actions call TanStack Start server functions.
- Server functions check Postgres workspace membership.
- Server functions call `WorkspaceKernel` commands.
- Kernel commands mutate DO SQLite and `@cloudflare/shell`.
- The current bridge still has the server schedule a compact `workspace.event` broadcast through `WorkspaceKernel`.
- The UI connects to `WorkspaceKernel` through `useAgent`, receives custom workspace messages, and invalidates TanStack Query workspace caches.

This bridge is intentionally coarse for the first kernel phase. The next foundation step is to move event creation, revision assignment, and broadcast into the kernel command itself, then have mutations and realtime messages apply the same cache event adapter. That makes reconnect, optimistic updates, AI writes, and future event replay one protocol instead of separate paths.

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

Thinkex should adapt this as a `DocumentSession` pattern, not as the root workspace pattern. The root workspace kernel should know that an item exists and what its current checkpoint is; the document session should own the bursty open-editor collaboration session.

## AI Integration

The current `AIThread` reads workspace items through a small `workspace-kernel-access` boundary. That boundary should remain the only AI-facing workspace access layer and should call the workspace kernel, not Postgres-backed workspace body query helpers.

Important distinction from the Think package:

- `AIThread` may still have its own Think-provided `this.workspace`, but that storage belongs to the AI thread Durable Object.
- The shared user-visible workspace must live in `WorkspaceKernel`, not in a private `AIThread` filesystem.
- Treat an AI thread workspace as scratchpad/transient agent state unless a tool explicitly commits output through `WorkspaceKernel`.
- If Think's built-in workspace tools are too tied to the thread-local workspace, expose kernel-backed tools with `createWorkspaceTools()` or custom AI SDK tools instead.

```txt
AIThread
  get thread/chat state from Agent storage
  call WorkspaceKernel tools for workspace reads/writes
  propose or execute commands depending on approval policy

WorkspaceKernel
  enforce permissions
  enforce registry capabilities
  adapt commands to @cloudflare/shell workspace operations
  mutate workspace state
  write events
  broadcast changes
  enqueue derived work
```

Potential tools:

```txt
listItems
readItem
readFile
writeFile
editFile
grepWorkspace
diffFile
applyEditPlan
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
runWorkspaceScript
runSandboxTask
```

AI write policy should be explicit:

- safe reads can execute directly after authorization
- low-risk creations may execute directly if the user requested them
- destructive edits, source overwrites, deletes, and bulk operations should require approval
- generated outputs should usually be derivatives or new snapshots, not silent source rewrites

Use the SDK approval primitives where they fit the UX:

- `needsApproval` can pause a server tool before execution and ask the client for approval.
- `beforeToolCall` can block, clamp, or substitute tool calls before a server tool runs.
- `activeTools` can narrow the tool surface for a given turn.

The kernel still remains the final authority. SDK approval is interaction plumbing; kernel permission and capability checks are mandatory even after the user approves a tool call.

Tool calls should carry enough identity for the workspace kernel to enforce and audit the action:

```txt
workspaceId
userId
agentSessionId or threadId
requested capability
itemId, parentId, or query
representation and budget
```

The workspace kernel, not the chat agent, should decide whether an item is AI-readable or AI-editable. For example:

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

## Future Cross-Workspace AI Memory

Users rarely need manual cross-workspace queries, but the AI may eventually need opt-in cross-workspace memory. This is not required for the first kernel migration.

This should be derived, not canonical:

```txt
WorkspaceKernel
  publishes compact workspace memory cards
  publishes item chunks or summaries after indexing

Central index
  stores workspaceId, itemId, chunkId, permission metadata, freshness marker

AI agent
  asks central index for candidate memories
  filters by user/agent permission
  calls relevant WorkspaceKernels for deeper authorized context
```

Two possible designs:

1. Shared AI Search instance with tenant/workspace metadata filters.
2. Custom Vectorize or Postgres/pgvector index if Thinkex needs more control over chunking, permissions, ranking, freshness, or deletion.

AI Search looks promising for early derived retrieval, but we need to validate permission filtering, deletion semantics, freshness, cost, and whether the managed model is flexible enough.

## Migration Plan

The app is early enough to cut faster than a long compatibility migration.

Migration posture:

- reset development workspace data when useful
- delete misleading old workspace-body paths instead of preserving shims
- keep clear temporary stubs at kernel boundaries
- do not add `storageMode` or dual-write logic unless production data forces it later
- keep Postgres only for central account, organization, membership, and directory data

### Phase 0: Stop Building On Postgres Workspace Body

Stop treating the current Postgres workspace body tables as a product surface. Remove them from the schema and route item operations through the kernel path only.

Central Postgres should remain responsible for:

- users
- organizations
- workspace directory rows
- workspace membership
- invites
- billing and quotas

Workspace body tables such as the old item tree, snapshots, assets, item events, search rows, and per-item user state should be replaced by `WorkspaceKernel` storage instead of supported through compatibility shims.

### Phase 1: Create WorkspaceKernel As The Only Workspace Body

Add `WorkspaceKernel` as an Agent-backed workspace kernel for workspace body state.

Responsibilities:

- initialize `@cloudflare/shell` `Workspace` with DO SQLite and optional R2 spillover
- create only the Thinkex product registry tables that Shell does not provide
- expose callable commands such as `getPage`, `listItems`, `createItem`, `renameItem`, `moveItem`, and `deleteItem`
- broadcast workspace changes to connected clients
- enforce workspace permissions and object registry capabilities
- write all user and AI mutations through the same command path

Do not hand-roll item/content/snapshot storage until the Shell spike proves what is missing. The first kernel should be a thin product wrapper around Shell plus a minimal registry.

### Phase 2: Route Workspace Pages Through WorkspaceKernel

For workspaces:

- route loaders read workspace directory and membership from central Postgres
- route loaders read workspace body from `WorkspaceKernel.getPage`
- workspace UI commands call `WorkspaceKernel`
- current AI tools call `WorkspaceKernel` instead of Postgres query helpers

Development workspace data can be reset instead of migrated.

### Phase 3: Command, Event, And Cache Protocol

Before adding more item UIs, turn the current coarse realtime bridge into a durable protocol:

- add `kernel_events` and `kernel_meta`
- assign monotonic workspace revisions inside `WorkspaceKernel`
- return `{ result, event, revision }` from mutating kernel commands
- broadcast events from the kernel after the committed write
- include `clientMutationId` on mutating commands and events
- build one TanStack Query event applier used by mutation success and websocket messages
- refetch the workspace page on reconnect or event revision gaps
- keep current full-page invalidation as the fallback, not the default success path

This is the foundation for manual changes, other users' changes, and AI writes to stay synchronized without duplicating cache behavior.

### Phase 4: AI Tools Over Shell-Backed Kernel

Expose the first safe AI tools over the kernel:

- list workspace tree
- read text content
- write a new document
- edit a document with exact replacement
- grep/search local text
- create flashcard/quiz derivatives

Then test `createExecuteTool` with a restricted Dynamic Worker loader for multi-file or multi-item automation. Keep network access blocked unless an explicit product workflow allows it.

### Phase 5: Document Sessions For Live Collaboration

Introduce document sessions only for item types that need high-frequency collaboration.

Initial candidates:

- document editor
- code/text editor if collaborative editing is enabled

Do not create document sessions for passive PDFs, images, or audio playback unless a workflow proves it needs one.

### Phase 6: Real Sandbox Execution

Add Cloudflare Sandbox SDK only after the durable workspace and safe AI tools work.

Initial sandbox tasks should be explicit, bounded, and user-visible:

- run code/data analysis on selected files
- execute package installs/builds/tests
- create generated artifacts in a sandbox output folder
- write approved outputs back to WorkspaceKernel

The sandbox should use per-task or per-session naming. Do not make one always-on sandbox per workspace unless a workflow proves it needs that cost and state model.

### Phase 7: Deferred Cross-Workspace Memory

After the workspace kernel exists and basic AI tools read through it, publish derived memory from workspace kernels to a central retrieval layer.

Start with:

- workspace summary
- item title/path/type
- extracted text chunks
- authored text chunks
- generated summaries
- permission metadata

Do not let the central index become source of truth.

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
workspace_kernel_locations
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
kernelName
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

Durable Objects do not currently relocate automatically after creation. The initial workspace kernel location matters.

Open design:

- choose location hint from owner/org region at workspace creation
- support jurisdiction-restricted namespaces where required
- store location/jurisdiction in the workspace directory
- do not assume moving a workspace kernel between regions is easy

## Observability And Repair

Kernel-first storage requires extra operational tooling that Postgres currently gives almost for free.

Needed before production migration:

- inspect workspace kernel manifest
- inspect Shell workspace tree and backing records
- export workspace kernel to portable JSON/R2 bundle
- import workspace kernel from bundle
- run integrity checks
- list kernel events
- rebuild local search manifest
- rebuild central search/memory index
- recover via DO point-in-time recovery where appropriate

This is a real cost of the kernel-first model.

## Risks

- Migrations across many kernel-local SQLite databases are harder than one Postgres schema.
- Debugging and repair require custom tools.
- Cross-workspace product analytics and admin views become derived or central-summary based.
- A single busy workspace kernel can become a hotspot.
- Large content must spill to R2 because of DO row limits.
- `@cloudflare/shell` is experimental/new enough that package boundaries may shift.
- Shell's filesystem abstraction may not perfectly match Thinkex item semantics, so a product registry layer is still required.
- The event/revision/cache layer is app-owned. If it is underspecified, manual UI changes, AI writes, and remote collaborators will diverge.
- Hocuspocus/Yjs/tldraw are useful item-session libraries, but each brings its own protocol and persistence model that must checkpoint through the kernel instead of becoming a second workspace truth.
- Dynamic Worker `execute` is powerful but must be capability-scoped; otherwise it can become an unaudited write path.
- Full Cloudflare Sandbox SDK introduces container cold starts, paid-plan requirements, lifecycle complexity, and a larger security review.
- In-memory DO state is not durable across hibernation or restart.
- AI writes can become dangerous unless forced through a validated command API.
- Vendor lock-in increases because workspace state lives in Cloudflare Durable Object backed Agent storage.
- Local development and testing must faithfully emulate Workers, Agents, R2, and DO storage.

## Assumptions

- Most workspaces stay under 1,000 visible items.
- Large PDFs, audio files, images, and future video live in R2.
- Workspace-level permissions are enough for the first kernel-first version.
- Users mainly work inside one workspace at a time.
- Cross-workspace AI is useful later but can be served by derived memory and retrieval.
- Live collaboration starts with a small number of item types.
- Postgres can remain for account, org, membership, and directory data.
- Cloudflare Agents sub-agents are stable enough to prototype parent-child document sessions, but not yet proven enough to make them the only design option.
- `@cloudflare/shell` can serve as the first low-level workspace filesystem until a spike proves otherwise.
- Real bash/Linux execution is not required for the first kernel slice.
- Real bash/Linux execution will use Cloudflare Sandbox SDK directly, not `createSandboxTools`, unless Think's helper becomes implemented.

## Open Questions

1. Should `WorkspaceKernel` continue extending Cloudflare `Agent` after the first prototype, or should it fall back to a plain Durable Object if the SDK gets in the way?
2. Should `DocumentSession` be an Agent sub-agent or a normal named Durable Object after testing the editor collaboration library?
3. Should private AI threads remain under `UserAIStore` permanently, or should Thinkex later add a separate shared workspace AI thread type?
4. Should workspace membership stay only in the central database, or should the workspace kernel cache membership for low-latency checks?
5. What is the exact approval policy for AI writes?
6. What is the minimum export format for a self-contained workspace bundle?
7. What should be inline in kernel SQLite versus stored as R2-backed snapshot body?
8. Should item ids map to Shell paths, or should Shell paths be the primary identifiers?
9. Which Shell operations should be exposed directly to AI, and which must be wrapped in product commands?
10. How should kernel schema migrations run across many workspaces?
11. What is the recovery story if a kernel import partially succeeds?
12. How much local search should live inside `WorkspaceKernel`/Shell before using AI Search or Vectorize?
13. Can AI Search satisfy Thinkex permission filtering and deletion requirements, or do we need a custom retrieval index?
14. What data location and jurisdiction choices should be exposed to users or org admins?
15. How should billing and quotas account for per-workspace DO storage, R2 bytes, sandbox runtime, indexing rows, and AI usage?
16. How should tests create, reset, inspect, and seed kernel-backed workspaces?
17. What user-facing workflows truly need Cloudflare Sandbox SDK versus Shell plus Dynamic Worker execute?
18. Should the first Tiptap `DocumentSession` use Hocuspocus v4 on Workers, a custom Yjs Durable Object, or another provider once the kernel checkpoint contract exists?

## Near-Term Recommendation

Keep `WorkspaceKernel` as the only workspace-body path and harden the protocol around it before adding richer editors.

Do not spend more time expanding the Postgres workspace body as the canonical model. Keep central Postgres for account, organization, membership, and workspace directory data.

Already completed in the current foundation branch:

- `WorkspaceKernel` binding and SQLite migration
- `@cloudflare/shell` `Workspace` initialized against `this.ctx.storage.sql`
- minimal product registry that maps stable item ids to Shell paths
- `getPage`, `listItems`, `createItem`, `renameItem`, `moveItem`, `deleteItem`, `readItem`, and `writeItem`
- route loader support for kernel-mode workspaces
- `workspace-kernel-access` backed by `WorkspaceKernel`
- `UserAIStore` / `AIThread` runtime names and `/user-ai` routing
- `AIThread` reads routed through `workspace-kernel-access`
- browser workspace presence connected through the Agents client SDK

The next implementation step should not be another item UI. It should be the command/event/cache foundation:

- add `kernel_events` and `kernel_meta`
- return command envelopes with `result`, `event`, and `revision`
- move event creation and broadcasting into `WorkspaceKernel`
- thread `clientMutationId` through user mutations
- build `applyWorkspaceEventToCache(queryClient, event)`
- use the same event applier from mutation success and websocket messages
- refetch on reconnect or revision gaps
- keep R2 asset pointer shape defined early, even if upload UX stays minimal

## Prototype Spikes

Before broad feature work, run small implementation spikes:

1. Command/event/cache protocol
   - Add durable kernel event rows and revision tracking.
   - Return command envelopes from every mutating kernel method.
   - Broadcast only committed kernel events.
   - Patch TanStack Query caches from a shared event applier.
   - Verify same-tab optimistic writes, second-browser writes, AI writes, reconnect refetch, and revision-gap fallback.

2. Shell Tool Surface
   - Expose read/list/grep/edit through kernel-safe tools.
   - Confirm large files spill to R2 without changing the read API.
   - Confirm path traversal, MIME/type restrictions, and permission checks stay in the kernel.

3. AIThread write tools
   - Keep chat transcript private in `UserAIStore` / `AIThread`.
   - Add first write-capable tools through `workspace-kernel-access`.
   - Make AI mutations produce the same kernel events as user mutations.
   - Require approval for destructive or bulk operations.

4. Dynamic Worker Execute
   - Add `createExecuteTool` only after basic kernel tools exist.
   - Expose a tiny tool/state surface.
   - Block outbound network by default.
   - Test a multi-file grep/summarize/edit workflow.

5. Single document session
   - Pick a simple text document first.
   - Keep item metadata in the workspace layer.
   - Route high-frequency collaboration to the document session.
   - Persist checkpoints back through the workspace command API.

6. R2 snapshot spillover
   - Store small content inline and large content in R2 behind the same `readContent` API.
   - Verify AI reads do not care where the content body lives.

7. Cloudflare Sandbox SDK
   - Run one explicit per-task Linux sandbox.
   - Sync selected kernel files into `/workspace`.
   - Run a simple `python` or `npm` command.
   - Write approved output files back through the kernel.

8. Future cross-workspace memory sketch
   - Publish two or three summary records from each workspace.
   - Query them with permission metadata.
   - Fetch deeper context from the source workspace kernel only after authorization.
