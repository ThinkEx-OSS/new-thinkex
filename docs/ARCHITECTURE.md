# ThinkEx Architecture

ThinkEx is moving from a Postgres-owned workspace body to a Cloudflare-native workspace kernel. The product still presents workspaces, folders, documents, files, flashcards, quizzes, tabs, viewers, editors, and AI. The kernel/filesystem model is an internal architecture for making those surfaces share one durable source of truth.

This document is the single architecture source of truth. Keep it current as the implementation changes.

## Current Baseline

ThinkEx is intentionally between the old Postgres workspace-body model and the new kernel model.

Current responsibilities:

- Postgres owns auth, users, workspace directory records, and workspace membership.
- Postgres no longer owns workspace item trees, content snapshots, item assets, workspace events, item search rows, or per-item user state.
- `WorkspaceKernel` is an Agent-backed Durable Object and owns the workspace body.
- `WorkspaceKernel` wraps `@cloudflare/shell` as the low-level durable filesystem.
- `@cloudflare/shell` is configured with the `WORKSPACE_KERNEL_FILES` R2 binding and the package default `1_500_000` byte inline threshold for large workspace-file spillover.
- `WorkspaceKernel` owns item metadata, shell path mapping, compact workspace events, revision assignment, lightweight presence, and coarse realtime event fanout.
- `UserAIStore` owns user-scoped AI thread metadata.
- `AIThread` owns an individual AI conversation and currently reads workspace facts through `workspace-kernel-access`.
- The document editor is deferred; Tiptap/Yjs is the selected editor/collaboration stack, but documents currently open to a lightweight item surface while the kernel, events, and AI tool boundary settle.

## Target Shape

```txt
React UI
  TanStack Router routes
  TanStack Query cache
  workspace item/viewer registry
  calls server functions for user actions

TanStack Start / Worker entry
  auth boundary
  central account/org APIs
  routes workspace reads/writes to WorkspaceKernel
  routes user AI traffic to UserAIStore

Central Postgres
  users/auth
  organizations
  workspace directory
  workspace membership
  billing, quotas, audit summaries
  cross-workspace index bookkeeping

WorkspaceKernel(workspaceId)
  canonical workspace body
  product item registry
  @cloudflare/shell Workspace
  command/event/revision protocol
  lightweight presence and websocket fanout
  workspace-local AI-readable projections
  lifecycle boundary for future document sessions

DocumentSession(workspaceId:itemId)
  named Durable Object per document item room
  Tiptap/Yjs document session state
  checkpoints meaningful snapshots back to WorkspaceKernel

UserAIStore(userId)
  private user AI thread directory
  thread title/status/unread/viewed/deleted state
  creates AIThread sub-agents

AIThread(threadId)
  chat runtime and tool execution
  private Think workspace for thread-local scratch files
  calls WorkspaceKernel for shared workspace reads/writes

R2
  large workspace file spillover
  uploaded PDFs, audio, images, Office files, exports
  generated artifacts and derivatives
```

## Source Of Truth

### Central Postgres

Postgres remains authoritative for data that naturally crosses workspaces:

- user identity and auth-related app ids
- organizations and teams
- workspace directory rows
- workspace membership, roles, and invites
- plan limits, billing, quotas, and abuse controls
- global audit summaries
- cross-workspace index bookkeeping
- export/import job records when they need central visibility

Postgres should not own the full item tree or workspace content body in the kernel-first target.

### WorkspaceKernel

`WorkspaceKernel` is authoritative for data that belongs inside one workspace:

- folders and item tree
- item names, types, ordering, colors, and lightweight metadata
- stable item ids mapped to shell paths
- `@cloudflare/shell` workspace files and directories
- current snapshot and asset pointer metadata
- workspace command/event log
- workspace-local search text and projections
- lightweight workspace presence
- compact realtime event fanout
- workspace-local AI-readable context

The kernel exposes product methods, not raw storage. The UI and AI both go through the same command API.

### Shell And R2

`@cloudflare/shell` is the first low-level filesystem layer. It is not a user-visible terminal and it is not Linux bash. It gives ThinkEx a durable virtual filesystem backed by Durable Object SQLite and optional R2 spillover.

ThinkEx should use Shell for:

- file and directory storage
- read/write/list/glob/stat/rm operations
- text search, replace, diff, and edit-plan helpers where they fit
- large file spillover through R2

R2 owns bytes that do not belong in Durable Object SQLite:

- PDFs
- audio and images
- future video
- Office files
- large text/code files
- large document snapshots
- generated exports and derivatives
- sandbox artifacts

`WorkspaceKernel` stores pointers, hashes, sizes, MIME information, item capability metadata, and current snapshot references. R2 is not a queryable workspace database.

## Workspace Commands And Events

Synchronous workspace commands are the app's immediate mutation API. They are for UI and AI actions that need a concrete result now:

- create item
- rename item
- move item
- delete item
- read/list item metadata
- save small item content

The command path is:

```txt
Workspace UI / AI tool
  calls server function or kernel access helper

Server function
  validates central workspace membership and user role
  calls WorkspaceKernel command

WorkspaceKernel command
  validates local item capability
  mutates kernel_items and/or @cloudflare/shell
  commits a kernel_events row
  assigns a monotonic workspace revision
  broadcasts workspace.event
  returns { result, event }
```

Current kernel-local tables:

- `kernel_items`: product item registry and Shell path mapping.
- `kernel_events`: append-only committed workspace events.
- `kernel_meta`: small key-value records such as the current workspace revision.

Current event shape:

```txt
id
revision
type
actor_user_id
client_mutation_id
payload_json
created_at
```

Command/event rules:

- Mutating commands return `{ result, event }`.
- Mutation success and websocket messages use the same TanStack Query event applier.
- Events carry enough item summary data to patch the workspace page cache without a full refetch.
- Content events identify the item and committed fact; large content does not go in event payloads.
- Asset events should carry pointer metadata, not bytes.
- `clientMutationId` is event metadata used by the browser to ignore its own optimistic realtime echo.
- Revision assignment and event insert happen inside the Durable Object SQLite transaction boundary.
- Shell/R2 writes and SQLite writes are not one ACID transaction; do not fake that with broad compensation code.
- For now, reconnects or revision gaps refetch the workspace page. `getEventsSince(revision)` exists as the future replay path.

## Realtime Collaboration

The root workspace kernel owns low-frequency committed collaboration:

- item created/renamed/moved/deleted
- content snapshot changed
- AI activity status
- connected-user presence
- coarse workspace event broadcast
- reconnect invalidation

High-frequency collaboration belongs in item/session runtimes:

- Tiptap/Yjs document editing
- cursor and selection state

The intended split is:

```txt
WorkspaceKernel(workspaceId)
  durable command owner
  workspace manifest and Shell files
  compact committed events

DocumentSession(workspaceId:itemId)
  normal named Durable Object per document item room
  Yjs sync and awareness protocol
  checkpoints document_json snapshots to WorkspaceKernel
```

ThinkEx documents use Tiptap/Yjs for WYSIWYG editing and live collaboration. The durable product record is a kernel-owned `document_json` snapshot. Markdown is only a future derived projection for import/export, AI context, and search/indexing, not the live collaboration source of truth.

Do not store Markdown as equal document truth. If Markdown becomes expensive enough to compute on demand, cache it as a derived artifact keyed by source snapshot id/revision and converter version so stale projections can be ignored or regenerated.

`DocumentSession` is a normal named Durable Object keyed by `workspaceId:itemId`. It owns Yjs binary update state and awareness for live cursors. `WorkspaceKernel` remains the durable product truth by receiving periodic `document_json` checkpoints from the session.

## AI Integration

The user AI topology stays separate from the workspace kernel:

```txt
UserAIStore(userId)
  private thread directory and UX state

AIThread(threadId)
  conversation runtime
  private Think workspace
  scratch files, notes, intermediate plans, temporary generated data
  calls kernel-backed tools

WorkspaceKernel(workspaceId)
  shared workspace source of truth
  user-visible items, files, revisions, events, permissions
```

This keeps ownership clear:

- user chat directory state remains private/user-scoped
- workspace filesystem state remains shared/workspace-scoped
- `AIThread`'s built-in Think workspace is thread-local scratch space, not the product workspace
- private Think workspace files stay invisible to users unless the model explicitly commits an output through a product tool
- chat threads bridge to the workspace through typed tools
- shared workspace chats can be added later if the product needs them

Important rule: the shared user-visible workspace lives in `WorkspaceKernel`, not in `AIThread`'s private Think workspace. Treat thread-local AI storage as scratchpad state unless a tool explicitly commits output through `WorkspaceKernel`.

AI tools should make the boundary explicit:

- Think workspace tools are for private scratchpad work and temporary files.
- Product workspace tools go through `workspace-kernel-access` and then `WorkspaceKernel`.
- Product tools should use shell-like user-visible paths, item types, names, and capabilities.
- Raw database ids and Durable Object ids should stay internal unless a diagnostic or repair tool specifically needs them.
- Shell-like paths are the AI-facing workspace address format; the kernel maps those paths to stable item ids internally.
- Current product tools should start absolute-path-first. If ThinkEx adds `cd`/`pwd`, the current working directory belongs in `AIThread` thread state and `WorkspaceKernel` should still receive normalized absolute paths.
- A model may draft in the private Think workspace, but user-visible output is created or updated only by a kernel command.

Initial product workspace tools:

- `listWorkspaceItems`: list user-visible items like `ls`, rooted at the workspace or a folder item.
- `readWorkspaceItem`: read item metadata and supported text/projection content.
- `searchWorkspaceItems`: search names, extracted text, and workspace-local projections.
- `createWorkspaceDocument`: create a user-visible document item.
- `writeWorkspaceDocument`: create a new snapshot or apply a constrained edit to a document.
- `createWorkspaceFile`: commit generated or uploaded bytes as a file item.
- `createWorkspaceDerivative`: create flashcards, quizzes, summaries, exports, or other derived items from sources.
- `requestWorkspaceJob`: start extraction, transcription, conversion, indexing, or long-running generation.

Avoid exposing broad product tools too early:

- no direct delete or bulk overwrite until the product has a deliberate undo/recovery story
- no raw `rm`, `mv`, or arbitrary Shell writes against the product workspace
- no unbounded grep/read over every large file without limits and progress reporting
- no hidden mutation from private Think workspace into product workspace

AI write policy:

- safe reads can execute directly after authorization
- low-risk creations may execute directly if the user requested them
- there is no dedicated approval flow for now
- destructive edits, overwrites, deletes, and bulk operations should stay unavailable or be routed through normal product undo/recovery
- generated outputs should usually be new items, derivatives, or new snapshots rather than silent source rewrites

The kernel remains the final authority. Tool schemas reduce model mistakes, but kernel permission and capability checks remain mandatory.

## Execution Ladder

Do not treat "AI can run commands" as one capability.

### Tier 0: Workspace Filesystem

Use `@cloudflare/shell` through `WorkspaceKernel`.

Good for:

- list/read/write/edit files
- search and grep
- diff
- apply edit plans
- store large files through R2 spillover

This is the default for study, research, summarization, document edits, flashcard generation, quiz generation, and normal workspace changes.

### Tier 1: Sandboxed JavaScript Execute

Use a restricted Dynamic Worker execute tool when the model needs a short program to coordinate many workspace operations.

Good for:

- scanning many files without many model round trips
- transforming structured text/JSON
- deterministic analysis over selected workspace data
- generating derived files from existing items

Keep outbound network blocked unless an explicit workflow allows it. Expose only the kernel tools/state needed for the task.

### Tier 2: Real Linux Sandbox

Use Cloudflare Sandbox SDK only when a task truly needs Linux/container semantics:

- bash commands
- installing packages
- Python/Node data analysis
- running tests/builds
- generated mini-app previews
- long-running background processes

The sandbox is compute, not workspace source of truth. It should sync selected files from `WorkspaceKernel`, run bounded commands, collect outputs, and write approved artifacts back through kernel commands.

### Tier 3: Browser Automation

Use browser automation only for workflows that need an actual page/session, such as website QA, interaction, screenshotting, or authenticated browsing.

## Durable Execution

Use Cloudflare Agents durable execution for longer AI/background work, not for every immediate UI mutation.

Good durable jobs:

- importing and classifying uploaded files
- PDF extraction and OCR
- audio transcription
- Office/CSV conversion
- batch workspace edits
- generated PDFs, images, presentations, or exports
- indexing and derived memory updates
- repair/cleanup tasks

Durable execution should orchestrate Shell operations and kernel commands. It should produce progress events as useful, but it should not replace simple synchronous commands like rename or move.

### PDF Extraction Pipeline

Uploaded PDFs follow the kernel-first job pattern:

```txt
Upload route
  validates user and file
  stores source bytes in WORKSPACE_KERNEL_FILES
  calls WorkspaceKernel.createFileFromUpload
  requests WorkspaceFileExtractionWorkflow

WorkspaceFileExtractionWorkflow
  marks file projections queued/processing in WorkspaceKernel
  reads canonical PDF bytes from WorkspaceKernel/Shell
  asks the extraction router for provider + mode
  calls the selected provider
  writes the markdown projection back through WorkspaceKernel
  marks projections ready, needs_review, or failed

WorkspaceKernel
  keeps original PDF bytes as source truth
  stores projection status/provider metadata in kernel_item_projections
  stores projection bodies as Shell files so large markdown can spill to R2
  keeps extraction state out of normal item metadata because users do not browse it directly
```

The active provider is Firecrawl `/v2/parse` with PDF `auto` mode. `auto` is the default route because it attempts embedded-text extraction first and falls back to OCR for scanned or image-heavy pages. The canonical extraction output is Markdown plus provider metadata. Workers AI To Markdown, Mistral OCR, and LlamaParse are intentionally present only as stubbed provider ids until their credentials, pricing limits, data-retention posture, quality gates, and routing rules are explicit.

Provider routing belongs in `routePdfExtraction`, not in upload routes or kernel commands. Future routing inputs should include org policy, file size/page count, privacy tier, language hints, cost ceiling, retry history, and quality feedback.

The model-facing `workspace_read_items` tool reads extracted PDF Markdown only after the projection is `ready` or `needs_review`. The tool returns clean Markdown and includes a small `page` cursor only when the response is truncated or a non-default offset was requested; long documents and extracted PDFs are continued with `contentOffset=page.next` when `next` is present. Provider-specific metadata stays out of the model read payload unless it directly explains extraction status.

## File And Item Model

The kernel should keep stable product item ids and map them to Shell paths. This keeps rename/move semantics product-controlled instead of making paths the public identity.

Initial item families:

- `folder`: tree structure and organization.
- `document`: authored text/document body, eventually with live editor sessions.
- `file`: uploaded or generated binary/text object with type-specific viewers and extracted projections.
- `flashcard`: structured study content.
- `quiz`: structured assessment content.

File support should grow by capability:

- original bytes in Shell/R2
- MIME/type classification
- preview/viewer support
- extracted text/projections for AI
- conversion/export actions
- generated derivatives

Some files may not have rich UI yet but can still live in the workspace as context.

## Migration State

Already completed in the current foundation work:

- `WorkspaceKernel` Durable Object binding and SQLite migration.
- `@cloudflare/shell` `Workspace` initialized against `this.ctx.storage.sql`.
- R2 spillover configured through `WORKSPACE_KERNEL_FILES`.
- Minimal product registry that maps stable item ids to Shell paths.
- `getPage`, `listItems`, `createItem`, `renameItem`, `moveItem`, `deleteItem`, `readItem`, and `writeItem`.
- Kernel events, workspace revisions, and command envelopes.
- `clientMutationId` threading for local echo suppression.
- Route loader support for kernel-mode workspaces.
- `workspace-kernel-access` backed by `WorkspaceKernel`.
- Workspace presence over the Agents client SDK.
- Shared TanStack Query workspace event applier.
- `UserAIStore` / `AIThread` runtime names and `/user-ai` routing.
- `AIThread` list-workspace-items tool routed through `workspace-kernel-access`.
- PDF upload extraction primitives: `WorkspaceFileExtractionWorkflow`, provider router, Firecrawl provider, provider stubs, and kernel-local projection status/body storage.

Next implementation focus:

- expose safe AI read/list/search tools over the kernel
- add controlled create/edit document tools
- keep document writes on canonical `document_json` snapshots
- require approval for destructive or bulk AI actions
- expand upload/import beyond PDFs and route non-PDF documents through the same provider/job boundary
- add transcription/conversion jobs as durable workflows
- define the Tiptap/Yjs document editor/session contract

## Operations And Repair

Kernel-first storage needs operational tooling that a single Postgres schema previously provided more directly.

Needed before production migration:

- inspect a workspace kernel manifest
- inspect Shell workspace tree and backing records
- list kernel events and revisions
- export a workspace to portable JSON plus R2 bundle
- import a workspace bundle
- run integrity checks
- rebuild local search/projection manifests
- rebuild central search/memory indexes
- identify and clean orphaned large objects
- recover with Durable Object point-in-time recovery where appropriate

## Risks

- Migrations across many kernel-local SQLite databases are harder than one Postgres schema.
- Debugging and repair require custom tools.
- Cross-workspace analytics and admin views become derived or central-summary based.
- A single busy workspace kernel can become a hotspot.
- Large content must spill to R2 because of Durable Object storage limits.
- `@cloudflare/shell` is experimental enough that package boundaries may shift.
- Shell's filesystem abstraction does not replace ThinkEx product item semantics.
- The event/revision/cache layer is app-owned.
- High-frequency editor protocols must checkpoint through the kernel instead of becoming a second workspace truth.
- Dynamic Worker execute and Sandbox execution must be capability-scoped and auditable.
- AI writes are dangerous unless forced through validated kernel commands.
- Local development and testing must emulate Workers, Agents, R2, and Durable Object storage closely enough to catch production issues.

## Open Questions

1. Should `WorkspaceKernel` continue extending Cloudflare `Agent`, or should it fall back to a plain Durable Object if SDK type/runtime constraints get in the way?
2. Should private AI threads remain under `UserAIStore` permanently, or should ThinkEx later add a shared workspace AI thread type?
3. Should workspace membership stay only in central Postgres, or should the kernel cache membership for low-latency checks?
4. What undo or recovery path is required before enabling destructive AI writes?
5. What is the minimum export format for a self-contained workspace bundle?
6. What should be inline in Durable Object SQLite versus stored as R2-backed snapshot body?
7. What path rules should the product workspace expose to AI, including escaping slashes in item names and handling duplicate names?
9. When should product AI tools add `cd`/`pwd` convenience on top of absolute paths?
10. Which Shell operations should be exposed directly to AI inside the private Think workspace, and which product operations must be wrapped in kernel commands?
11. How should kernel schema migrations run across many workspaces?
12. How much local search should live inside `WorkspaceKernel`/Shell before using AI Search, Vectorize, or another central retrieval index?
13. What data location and jurisdiction choices should be exposed to users or org admins?
14. How should billing and quotas account for per-workspace Durable Object storage, R2 bytes, sandbox runtime, indexing rows, and AI usage?
15. How should tests create, reset, inspect, and seed kernel-backed workspaces?
16. What user-facing workflows truly need Cloudflare Sandbox SDK versus Shell plus Dynamic Worker execute?
