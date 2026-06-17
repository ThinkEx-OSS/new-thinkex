# Local reference clones

ThinkEx keeps upstream/reference repositories outside the app git repo so:

- `git status` stays clean
- Cursor and agents can search real clone directories
- Typecheck, lint, and React Doctor stay scoped to app code

## Layout

```text
~/Downloads/
  new-thinkex/                 ← this repo (open via workspace file)
  new-thinkex-references/      ← local clones (embed-pdf-viewer, tiptap, etc.)
```

Do not use symlinks for reference clones. Cursor indexes real directories reliably; symlinked folders are often skipped.

## Setup

```bash
pnpm references:setup
```

Then open **`new-thinkex.code-workspace`** in Cursor (File → Open Workspace from File), not just the repo folder.

The workspace file adds `../new-thinkex-references` as a second root named `references`.

## Add a new reference clone

```bash
git clone <repo-url> ../new-thinkex-references/<name>
```

Examples already used in this project:

- `embed-pdf-viewer` — EmbedPDF APIs and examples
- `tiptap` / `tiptap-docs` — editor behavior
- `cloudflare-agents` — Workers agent patterns

## Git and tooling notes

- Reference clones keep their own `.git` history; the ThinkEx repo does not track them.
- Workspace git settings only scan the app repo by default (`git.scanRepositories: ["."]`).
- Search/file watchers exclude heavy paths inside reference clones (`node_modules`, `.git`, `dist`).
- App tooling (`tsconfig`, Biome, ESLint, React Doctor) excludes the sibling references directory.

## Custom location

Override the target directory when running setup:

```bash
REFERENCES_DIR="$HOME/dev/thinkex-references" pnpm references:setup
```

Update `new-thinkex.code-workspace` if you change the default sibling path.
