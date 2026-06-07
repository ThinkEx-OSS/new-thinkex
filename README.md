# ThinkEx

TanStack Start app on React, Better Auth, Drizzle/Postgres, and Cloudflare Workers.

## Setup

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs through Infisical and starts the app at `http://localhost:3000`.
Local development uses the Infisical `DATABASE_URL` directly. Hyperdrive is the
production Worker database path, not the normal local dev path.

## Configuration

- `.infisical.json` is project metadata and can be committed.
- Real local secrets live in Infisical.
- `wrangler.jsonc` declares required Cloudflare Worker secrets.
- Production secrets should be synced or provisioned into Cloudflare Workers secrets.

## Production

The initial production URL is:

```txt
https://new-thinkex.chakrabortyurjit.workers.dev
```

Use Infisical `prod` secrets at `/app` as the source of truth for production
Worker secrets:

```txt
BETTER_AUTH_URL=https://new-thinkex.chakrabortyurjit.workers.dev
BETTER_AUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Sync those exact keys to the Cloudflare Worker `new-thinkex`. Keep local-only
database secrets such as `DATABASE_URL` out of the Worker secret sync;
production database access uses the configured `HYPERDRIVE` binding.

The shared Google OAuth client must allow this redirect URI:

```txt
https://new-thinkex.chakrabortyurjit.workers.dev/api/auth/callback/google
```

## Commands

```bash
pnpm dev
pnpm db:generate
pnpm db:migrate
pnpm check
pnpm typecheck
pnpm build
pnpm deploy
```
