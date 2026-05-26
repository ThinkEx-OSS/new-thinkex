# ThinkEx

TanStack Start app on React, Better Auth, Drizzle/Postgres, and Cloudflare Workers.

## Setup

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs through Infisical and starts the app at `http://localhost:3000`.

## Configuration

- `.infisical.json` is project metadata and can be committed.
- Real local secrets live in Infisical.
- `wrangler.jsonc` declares required Cloudflare Worker secrets.
- Production secrets should be synced or provisioned into Cloudflare Workers secrets.

## Commands

```bash
pnpm dev
pnpm dev:hyperdrive
pnpm db:generate
pnpm db:migrate
pnpm check
pnpm typecheck
pnpm build
pnpm deploy
```
