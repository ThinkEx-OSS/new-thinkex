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

Keep three separate concepts:

```txt
workspace_items
  tree node and shared metadata for every item

content_snapshots
  versioned content for editable items and extracted text

item_assets
  binary/object-storage metadata for uploaded files
```

Do not create type-specific tables at first for documents, flashcards, or quizzes. Their current state and history should live in `content_snapshots`, with `workspace_items.currentSnapshotId` pointing at the latest snapshot.

Use `item_assets` only when the item has an uploaded binary in R2. A PDF item should have a `workspace_items` row and an `item_assets` row. A document, flashcard, quiz, or folder should not need an `item_assets` row.

## Workspace Tables

### `workspaces`

Stores the workspace itself.

```txt
id
name
icon
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
type                  // folder | document | flashcard | quiz | pdf
name
sortOrder
metadataJson
currentSnapshotId
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

Paths should be derived from `parentId` relationships. A cached path can be added later if needed for search or agent ergonomics.

## Editable Content

Documents, flashcards, and quizzes are editable. They should all produce versioned snapshots. PDFs can also produce snapshots later for extracted text, but their original file lives in `item_assets`.

### `content_snapshots`

```txt
id
workspaceId
itemId
versionNumber
contentFormat          // markdown | flashcard_json | quiz_json | pdf_text
contentText            // markdown/plain text/searchable text
contentJson            // structured flashcards/quizzes
yjsStateRef            // optional later if storing Yjs state separately
createdByType          // user | agent | system
createdByUserId
createdByAgentSessionId
reason                 // autosave | ai_edit | import | restore
createdAt
```

Initial assumptions:

- Documents are probably Markdown, but the exact editor can be decided later.
- Flashcards are edited through structured UI and stored as structured JSON.
- Quizzes are edited through structured UI and stored as structured JSON.
- Version history is based on autosaved snapshots.
- Folders do not have content snapshots.
- PDFs do not have editable snapshots initially, but can have extracted text snapshots later.

Autosave should be throttled so every keystroke does not create a permanent version. Important AI edits should also create snapshots.

## Item Assets

PDFs are uploaded/reference-only for now. No annotation or editing in the initial version.

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
extractedTextSnapshotId
createdByUserId
createdAt
```

PDF text extraction can be added later by creating a `content_snapshots` row with `contentFormat = pdf_text` and setting `item_assets.extractedTextSnapshotId`.

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

Do not build semantic search or vector indexing now. The current requirement is only to keep clean `content_snapshots` and `workspace_events` so a later indexing phase can process existing workspace content without reshaping the core data model.

## Initial Implementation Order

1. Add workspace, member, item, snapshot, asset, and event tables.
2. Build workspace tree CRUD with soft delete and autosaved content snapshots.
3. Add PartyServer workspace room for realtime tree updates.
4. Add Yjs/Y-PartyServer rooms for open documents.
5. Extend Yjs editing to flashcards and quizzes.
6. Add R2-backed PDF uploads.
7. Add private AI chat sessions later.
8. Route AI edits through the same item/content mutation APIs.
9. Add semantic indexing later from existing snapshots/events.
