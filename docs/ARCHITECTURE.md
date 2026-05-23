# Thinkex Workspace Architecture Plan

## Goal

Thinkex workspaces should feel like a collaborative filesystem. Users can create folders, upload PDFs, edit documents, build flashcard decks, build quizzes, and move items around the workspace in real time. Each user also has a private AI chat assistant that can see their current context and make changes to the shared workspace on their behalf.

The architecture should support semantic search later, but the initial schema does not need vector indexing.

## Core Model

Use a virtual filesystem model backed by database records.

Example workspace:

```txt
/notes/week-1.md
/flashcards/spanish.cards.json
/quizzes/cell-division.quiz.json
/sources/chapter-4.pdf
```

The user sees folders and files, but the source of truth is Postgres. Large uploaded files live in object storage.

## Runtime Split

Use different realtime systems for different jobs:

```txt
Workspace tree updates
  PartyServer / Durable Object room per workspace

Collaborative item editing
  Yjs + Y-PartyServer / Durable Object room per editable item

Private AI chat
  Later phase; private per user, can act on the shared workspace

Durable data
  Postgres

Large uploads
  R2
```

Do not make the whole workspace one giant Yjs document. Use Yjs only for collaborative editable item content.

## Storage Shape

Keep four separate concepts:

```txt
workspace_items
  tree node and shared metadata for every item

content_snapshots
  versioned content for editable items and extracted text

item_assets
  binary/object-storage metadata for uploaded files

workspace_item_search
  one-row-per-item keyword search projection for current visible state
```

Do not create type-specific tables at first for documents, flashcards, quizzes, PDFs, or audio. Authored, extracted, and generated content history should live in `content_snapshots`, with `workspace_items.currentAuthoredSnapshotId` and `workspace_items.currentExtractedSnapshotId` pointing at the latest relevant snapshots.

Use `item_assets` only when the item has an uploaded binary in R2. PDF and audio items should have a `workspace_items` row and an `item_assets` row. A document, flashcard, quiz, or folder should not need an `item_assets` row.

## Workspace Tables

### `workspaces`

Stores the workspace itself.

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

Permissions are workspace-level for now. Item-level permissions can be added later.

```txt
id
workspaceId
userId
role        // owner | admin | editor | viewer
createdAt
updatedAt
```

## Workspace Filesystem

### `workspace_items`

Every visible item in the workspace tree is a row.

```txt
id
workspaceId
parentId              // null for root-level items
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

Recommended indexes and constraints:

```txt
index(workspaceId, parentId)
index(workspaceId, type)
unique(workspaceId, parentId, name) where deletedAt is null
```

Paths should be derived from `parentId` relationships. Do not make path the authoritative hierarchy. Search and future agent retrieval can store derived path-like display/scope data in projections if needed.

## Editable Content

Documents, flashcards, and quizzes are editable. They should all produce versioned authored snapshots. PDFs and audio files can produce extracted snapshots, but their original files live in `item_assets`.

### `content_snapshots`

```txt
id
workspaceId
itemId
kind                   // authored | extracted | generated
versionNumber
contentFormat          // markdown | plain_text | transcript_json | flashcard_json | quiz_json
contentText            // markdown/plain/searchable text; also derived text for JSON formats
contentJson            // structured transcripts/flashcards/quizzes
yjsStateRef            // optional later if storing Yjs state separately
createdByType          // user | agent | system
createdByUserId
createdByAgentSessionId
reason                 // autosave | ai_edit | import | restore | ocr | transcription | manual
createdAt
```

Initial assumptions:

- Documents are Markdown authored snapshots.
- PDF OCR/extracted content is Markdown extracted snapshots.
- Audio transcripts are structured JSON extracted snapshots, with derived text for search.
- Flashcards are edited through structured UI and stored as structured JSON.
- Quizzes are edited through structured UI and stored as structured JSON.
- Version history is based on autosaved snapshots.
- Folders do not have content snapshots.
- PDFs and audio do not have editable authored snapshots initially, but can have extracted snapshots.

Autosave should be throttled so every keystroke does not create a permanent version. Important AI edits should also create snapshots.

## Item Assets

PDFs and audio are uploaded/reference-only for now. No annotation or editing in the initial version.

### `item_assets`

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

PDF text extraction and audio transcription should create `content_snapshots` rows with `kind = extracted`. The active extracted snapshot pointer lives on `workspace_items.currentExtractedSnapshotId`.

This keeps the model simple:

```txt
folder
  workspace_items only

document
  workspace_items + content_snapshots

flashcard
  workspace_items + content_snapshots

quiz
  workspace_items + content_snapshots

pdf
  workspace_items + item_assets
  optional later: content_snapshots for extracted text

audio
  workspace_items + item_assets
  optional later: content_snapshots for transcript JSON
```

## Keyword Search

Normal user search should be fast keyword search across the current visible workspace state. Title/name matches should rank ahead of body/content matches, but the same result list should include matches from authored content, OCR text, transcripts, flashcards, and quizzes.

### `workspace_item_search`

```txt
itemId
workspaceId
nameText
metadataText           // derived from metadataJson and lightweight file metadata
contentText
extractedText
searchVector           // generated weighted tsvector
currentAuthoredSnapshotId
currentExtractedSnapshotId
status                 // pending | ready | failed
indexError
indexedAt
updatedAt
```

This table is a derived projection, not the source of truth. Name and metadata changes can update it synchronously with item mutations. Heavy content, OCR, and transcript indexing can be eventually consistent.

Keyword search should use a generated PostgreSQL `tsvector` column with a GIN index. Weight matches by source:

```txt
A  name/title text
B  derived metadata text
C  authored content text
D  extracted OCR/transcript text
```

## Realtime Rooms

### Workspace Room

One PartyServer room per workspace:

```txt
workspace:{workspaceId}
```

Broadcasts:

```txt
item.created
item.renamed
item.moved
item.deleted
item.restored
item.reordered
content.updated
asset.uploaded
agent.started
agent.completed
agent.failed
```

The database transaction should happen first. After commit, broadcast the event.

### File Collaboration Room

One Y-PartyServer room per editable item:

```txt
workspace:{workspaceId}:item:{itemId}
```

Used for:

```txt
documents
flashcards
quizzes
```

The room handles live collaborative edits while the item is open. It periodically persists snapshots to Postgres.

## Future AI Workspace Actions

Do not model AI conversations yet. When AI workspace actions are added, agents should use the same workspace APIs as users:

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
```

Every agent action should be permission-checked as the user and recorded in the audit log. The private chat/session data model can be designed later.

## Events And Version History

### `workspace_events`

Append-only event/audit log.

```txt
id
workspaceId
itemId
actorType              // user | agent | system
actorUserId
actorAgentSessionId    // nullable; only needed when agent sessions exist
eventType
payloadJson
createdAt
```

This powers:

- workspace activity
- version history
- debugging
- auditability
- future indexing jobs

Use this for both user and AI changes.

## Future Item-Level Permissions

Permissions are workspace-level initially. To support item-level permissions later, add:

```txt
workspace_item_permissions
  id
  workspaceId
  itemId
  subjectType      // user | group
  subjectId
  role             // owner | editor | viewer
  inheritedFromParentId
  createdAt
  updatedAt
```

Keep initial permission checks behind helper functions so this table can be introduced without rewriting every mutation.

## Future Semantic Search

Do not build semantic search or vector indexing now. The current requirement is to keep clean `content_snapshots`, `workspace_events`, and `workspace_item_search` so a later indexing phase can process existing workspace content without reshaping the core data model.

Future AI retrieval should support explicit modes:

```txt
keyword
semantic
hybrid
```

Semantic/hybrid retrieval should use separate chunk/index tables when implemented. Do not add chunk tables until chunking strategy, embedding model, vector dimensions, and indexing job semantics are decided.

## Initial Implementation Order

1. Add workspace, member, item, snapshot, asset, event, and keyword search projection tables.
2. Build workspace tree CRUD with soft delete and autosaved content snapshots.
3. Add PartyServer workspace room for realtime tree updates.
4. Add Yjs/Y-PartyServer rooms for open documents.
5. Extend Yjs editing to flashcards and quizzes.
6. Add R2-backed PDF and audio uploads.
7. Add private AI chat sessions later.
8. Route AI edits through the same item/content mutation APIs.
9. Add semantic indexing later from existing snapshots/events.
