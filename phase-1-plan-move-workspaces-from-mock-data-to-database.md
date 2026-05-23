# Phase 1 Plan: Move Workspaces From Mock Data To Database

## Summary

Phase 1 will make the workspace home and workspace detail pages use real database data instead of mock arrays. It will also add the first real mutation: clicking **Create workspace** instantly creates a DB workspace with defaults and navigates into it.

We will not add Hono or Effect in this phase. Backend logic will live in reusable server modules so Hono can be added later as a thin adapter for mobile/desktop clients.

## Goals

- Remove mock workspace data from runtime app flows.
- Home page lists only workspaces the signed-in user belongs to.
- Empty home state shows only the existing Create Workspace card and empty state copy.
- Create Workspace creates a real workspace immediately.
- Workspace detail page loads the workspace and its items from the DB.
- Access is membership-checked everywhere.
- Archived workspaces are hidden from normal views.
- Existing API route `GET /api/v1/workspaces` returns real DB data.
- Current UI still works even when the user has zero workspaces/items.

## Explicit Product Decisions

- Keep `workspaces.archivedAt`.
- Remove workspace `draft/ready` status from UI/contracts for now.
- Do not seed data.
- Do not use mock data in runtime routes after this phase.
- Create workspace behavior: instant create with defaults.
- Default workspace values:
  - `name`: `"Untitled Workspace"`
  - `icon`: `"compass"`
  - `color`: `"sky"`
  - `description`: `null`
- After create, navigate to `/workspaces/$workspaceId`.
- First created workspace has no items.
- Create mutation also creates `workspace_members` owner membership.
- IDs use `crypto.randomUUID()`.

## Files To Add

### `src/features/workspaces/server/mappers.ts`

Responsible for mapping DB rows to UI/API contracts.

Functions:

```ts
mapWorkspaceSummary(row): WorkspaceSummary
mapWorkspaceItem(row): WorkspaceItem
formatWorkspaceUpdatedAt(updatedAt: Date): string
getWorkspaceItemMetaText(row): string
```

Mapping rules:

- `WorkspaceSummary.id` <- `workspaces.id`
- `WorkspaceSummary.name` <- `workspaces.name`
- `WorkspaceSummary.icon` <- DB `icon`, default `"compass"`
- `WorkspaceSummary.color` <- DB `color`, default `"sky"`
- `WorkspaceSummary.updatedAt` <- human-ish string from `updatedAt`
- No `status`

Workspace item mapping:

- `id`, `workspaceId`, `type`, `parentId`, `name`, `sortOrder` from DB
- `meta` derived from `metadataJson` where possible:
  - folder meta remains computed in UI from child count
  - pdf/audio can use filename/duration/page count if present
  - otherwise `""`
- `icon` should not come from DB. Prefer changing `WorkspaceItem` so icon is display-derived by type, not stored on the item object.

### `src/features/workspaces/server/permissions.ts`

Functions:

```ts
getWorkspaceMembership(db, workspaceId, userId)
requireWorkspaceMembership(db, workspaceId, userId)
```

Rules:

- Membership is valid if a row exists in `workspace_members`.
- Archived workspace should be treated as unavailable for normal reads.
- Throw/return a typed not-found/forbidden result that route handlers can map to `notFound()` or API errors.

### `src/features/workspaces/server/queries.ts`

Functions:

```ts
listUserWorkspaces(userId): Promise<WorkspaceSummary[]>
getWorkspaceForUser(workspaceId, userId): Promise<WorkspaceSummary | null>
listWorkspaceItemsForUser(workspaceId, userId): Promise<WorkspaceItem[]>
getWorkspacePageData(workspaceId, userId): Promise<{
  workspace: WorkspaceSummary
  items: WorkspaceItem[]
} | null>
```

Query rules:

- Always create/dispose DB context inside server function wrappers or route handlers.
- `listUserWorkspaces`:
  - join `workspace_members` to `workspaces`
  - filter `workspace_members.userId = userId`
  - filter `workspaces.archivedAt is null`
  - order by `workspaces.updatedAt desc`
- `getWorkspaceForUser`:
  - require membership
  - filter archived workspaces out
- `listWorkspaceItemsForUser`:
  - require membership
  - filter `workspace_items.deletedAt is null`
  - order by `sortOrder asc`, then `name asc`

### `src/features/workspaces/server/mutations.ts`

Functions:

```ts
createWorkspaceForUser(userId): Promise<WorkspaceSummary>
```

Behavior:

- Use a DB transaction.
- Insert `workspaces` row:
  - `id = crypto.randomUUID()`
  - `name = "Untitled Workspace"`
  - `icon = "compass"`
  - `color = "sky"`
  - `ownerId = userId`
- Insert `workspace_members` row:
  - `id = crypto.randomUUID()`
  - `workspaceId = workspace.id`
  - `userId = userId`
  - `role = "owner"`
- Insert `workspace_events` row:
  - `eventType = "workspace.created"`
  - `actorType = "user"`
  - `actorUserId = userId`
  - `payloadJson` includes workspace name/icon/color
- Return mapped `WorkspaceSummary`.

### `src/features/workspaces/server/functions.ts`

TanStack Start server functions used by routes/components:

```ts
listCurrentUserWorkspaces()
getCurrentUserWorkspacePageData({ workspaceId })
createCurrentUserWorkspace()
```

Rules:

- Each function gets session from request headers using existing auth helper.
- If no session, throw unauthorized.
- Do not import DB server code directly into client components/routes except through server functions.

## Files To Update

### `src/lib/api/contracts.ts`

Replace `accent` with `color`.

Current:

```ts
workspaceAccentSchema
accent
status
```

New:

```ts
export const workspaceColorSchema = z.enum([
  "sky",
  "violet",
  "amber",
  "emerald",
]);

export const workspaceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: workspaceIconSchema,
  color: workspaceColorSchema,
  updatedAt: z.string(),
});
```

Remove:

- `workspaceAccentSchema`
- `WorkspaceAccent`
- `status`

Add:

- `WorkspaceColor`

### `src/features/workspaces/model/display.ts`

Rename accent concepts to color internally or keep local variable name if preferred, but source from `workspace.color`.

```ts
workspaceColors[workspace.color]
```

Return shape can remain:

```ts
{ Icon, accent }
```

to reduce UI churn, but the input must be `workspace.color`.

### `src/routes/_protected/home.tsx`

Replace mock `beforeLoad`.

New behavior:

- Call `listCurrentUserWorkspaces()`.
- Return `{ workspaces }`.
- Remove status filter state/dropdown.
- Keep text search over workspace name.
- Keep `CreateWorkspaceCard`.
- Wire `CreateWorkspaceCard.onCreate`:
  - call `createCurrentUserWorkspace()`
  - navigate to created workspace
  - optionally invalidate/refetch workspace list query if using query cache
- Empty state:
  - if no DB workspaces and no search query: show “No workspaces yet”
  - if search query has no results: show “No matching workspaces”
- No mock fallback.

### `src/routes/_protected/workspaces.$workspaceId.tsx`

Replace mock `beforeLoad` and item loading.

New behavior:

- Call `getCurrentUserWorkspacePageData({ workspaceId })`.
- If null, throw `notFound()`.
- Route context returns `{ workspace, workspaceItems }`.
- Component passes DB-loaded items into `WorkspaceShell`.
- No mock fallback.

### `src/routes/api/v1/workspaces.ts`

Replace `listMockWorkspaces()` with DB-backed logic.

Behavior:

- Get session using `getSessionFromRequest(request)`.
- If missing, return `401`.
- Call `listUserWorkspaces(session.user.id)`.
- Return `workspaceListResponseSchema.parse({ workspaces })`.

This route is still useful for future external/internal clients, even if the web app primarily uses server functions.

### `src/features/workspaces/model/types.ts`

Remove `icon: LucideIcon` from `WorkspaceItem`.

Reason:

- DB stores item type, not Lucide component.
- Display should be derived by `getWorkspaceItemDisplay(item.type)`.

New type:

```ts
export interface WorkspaceItem {
  id: string;
  workspaceId: string;
  type: WorkspaceItemType;
  parentId: string | null;
  name: string;
  meta: string;
  sortOrder: number;
}
```

### `src/features/workspaces/model/item-display.ts`

Update `getWorkspaceItemDisplay`.

Current behavior uses `item.icon`.

New behavior:

```ts
export function getWorkspaceItemDisplay(item: WorkspaceItem) {
  const typeDisplay = getWorkspaceItemTypeDisplay(item.type);

  return {
    ...typeDisplay,
    Icon: typeDisplay.icon,
  };
}
```

### `src/features/workspaces/index.ts`

Remove mock exports from public feature barrel after routes no longer use them:

```ts
listMockWorkspaceItems
listMockWorkspaces
```

Keep mock files only if tests still need them; otherwise delete in this phase.

### `src/features/workspaces/data/*`

Delete or quarantine mock runtime data after all runtime imports are gone.

Recommended:

- Delete `mock-workspaces.ts`
- Delete `mock-workspace-items.ts`
- Update/delete `mock-workspaces.test.ts`

If we want fixture examples later, recreate them under a test-only fixture path.

## API/Type Changes

### `WorkspaceSummary`

Before:

```ts
{
  id: string
  name: string
  icon: "compass" | "flask-conical" | "zap" | "book-marked"
  accent: "sky" | "violet" | "amber" | "emerald"
  updatedAt: string
  status: "draft" | "ready"
}
```

After:

```ts
{
  id: string
  name: string
  icon: "compass" | "flask-conical" | "zap" | "book-marked"
  color: "sky" | "violet" | "amber" | "emerald"
  updatedAt: string
}
```

### `WorkspaceItem`

Before:

```ts
{
  id: string
  workspaceId: string
  type: WorkspaceItemType
  parentId: string | null
  name: string
  meta: string
  icon: LucideIcon
  sortOrder: number
}
```

After:

```ts
{
  id: string
  workspaceId: string
  type: WorkspaceItemType
  parentId: string | null
  name: string
  meta: string
  sortOrder: number
}
```

## Data Flow

### Home Page Load

```txt
/_protected beforeLoad
  -> confirms auth
/_protected/home beforeLoad
  -> listCurrentUserWorkspaces server fn
    -> session from headers
    -> createDbContext
    -> listUserWorkspaces(session.user.id)
    -> map rows to WorkspaceSummary[]
  -> HomePage renders create card + real workspaces
```

### Create Workspace

```txt
User clicks CreateWorkspaceCard
  -> createCurrentUserWorkspace server fn
    -> session from headers
    -> createDbContext
    -> transaction:
      -> insert workspaces
      -> insert workspace_members owner row
      -> insert workspace_events workspace.created
    -> map to WorkspaceSummary
  -> navigate to /workspaces/:id
```

### Workspace Page Load

```txt
/workspaces/:workspaceId beforeLoad
  -> getCurrentUserWorkspacePageData server fn
    -> session from headers
    -> createDbContext
    -> require membership and non-archived workspace
    -> list non-deleted workspace_items
    -> map to UI types
  -> WorkspaceShell renders DB items
```

### API Route

```txt
GET /api/v1/workspaces
  -> getSessionFromRequest
  -> listUserWorkspaces(session.user.id)
  -> apiJson({ workspaces })
```

## Error Handling

- Unauthenticated server functions:
  - throw unauthorized error.
  - protected route should normally prevent this already.
- Workspace not found or not a member:
  - workspace route throws `notFound()`.
  - API returns `404` or `403`; prefer `404` to avoid leaking existence.
- DB errors:
  - API returns `500`.
  - route can surface existing `AppErrorScreen`.
- Create workspace failure:
  - show toast or leave card idle with no navigation.
  - log server-side error through existing API/server error handling.

## Testing And Verification

### Type/Static Checks

Run:

```sh
pnpm exec tsc --noEmit
pnpm exec biome check
```

### Unit Tests

Add/update tests for:

- `workspaceListResponseSchema` accepts `color` and no `status`.
- `mapWorkspaceSummary` defaults null DB icon/color to `compass`/`sky`.
- `mapWorkspaceItem` returns correct `WorkspaceItem` shape without icon.
- `getWorkspaceItemDisplay` derives icon from type.

### Server Query Tests

If current test setup can reach a test DB, add tests for:

- user sees only their workspaces
- archived workspaces are excluded
- non-member cannot load workspace
- deleted items are excluded
- items are ordered by `sortOrder`, then `name`

If no test DB harness exists yet, skip DB integration tests in phase 1 and note the gap.

### Manual Acceptance

With an empty database for the signed-in user:

- Home shows Create Workspace card.
- Home shows “No workspaces yet”.
- No mock workspace cards appear.

After clicking Create Workspace:

- A DB workspace row exists.
- A DB owner membership row exists.
- A `workspace.created` event exists.
- Browser navigates to the new workspace.
- Workspace page shows empty folder state.

After manually adding DB items or using a later mutation:

- Workspace page renders real items.
- Folder navigation works from DB `parentId`.

### API Acceptance

- `GET /api/v1/workspaces` unauthenticated returns `401`.
- `GET /api/v1/workspaces` authenticated returns real DB workspaces.
- Response validates against `workspaceListResponseSchema`.

## Out Of Scope For Phase 1

- Hono API app.
- Effect.
- Mobile/desktop API-specific structure.
- Workspace rename/settings dialog.
- Workspace archive/delete UI.
- Item creation/move/delete mutations.
- Uploads.
- Content editing.
- Realtime rooms.
- Semantic search.
- Search endpoint.
- Seed scripts.
- Mock fallback behavior.

## Assumptions

- Keep `archivedAt` for workspaces.
- No workspace status in product/API for now.
- `color` uses the same token set previously called `accent`: `sky`, `violet`, `amber`, `emerald`.
- `icon` uses the existing token set: `compass`, `flask-conical`, `zap`, `book-marked`.
- Runtime mock data should be removed, not kept as fallback.
- The create flow can be intentionally minimal: one click creates `"Untitled Workspace"` with default icon/color.
