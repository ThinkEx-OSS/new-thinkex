# Local reference clones

ThinkEx keeps upstream/reference repositories in a sibling `references/` folder so:

- `git status` in `web/` stays clean
- Cursor and agents can search real clone directories
- Typecheck, lint, and React Doctor stay scoped to app code

## Layout

```text
~/Desktop/new-thinkex/
  web/          ← this git repo
  references/   ← local clones (embed-pdf-viewer, tiptap, etc.)
  new-thinkex.code-workspace
```

Do not use symlinks for reference clones. Cursor indexes real directories reliably; symlinked folders are often skipped.

## Setup

From `web/`:

```bash
pnpm references:setup
```

Then open **`../new-thinkex.code-workspace`** in Cursor (File → Open Workspace from File), not just the `web/` folder.

## Add a new reference clone

```bash
git clone <repo-url> ../references/<name>
```

Examples already used in this project:

- `embed-pdf-viewer` — EmbedPDF APIs and examples
- `tiptap` / `tiptap-docs` — editor behavior
- `cloudflare-agents` — Workers agent patterns

## Git and tooling notes

- Reference clones keep their own `.git` history; the `web/` repo does not track them.
- Workspace git settings only scan `web/` by default (`git.scanRepositories: ["web"]`).
- Search/file watchers exclude heavy paths inside reference clones (`node_modules`, `.git`, `dist`).
- App tooling (`tsconfig`, Biome, ESLint, React Doctor) excludes `../references`.

## Custom location

Override the target directory when running setup:

```bash
REFERENCES_DIR="$HOME/dev/thinkex-references" pnpm references:setup
```

Update `new-thinkex.code-workspace` if you change the default layout.
