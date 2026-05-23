# ThinkEx

ThinkEx is a TanStack Start app with:

- React 19 and Vite
- shadcn/ui-style local components
- Better Auth for authentication
- Drizzle ORM with PostgreSQL
- Cloudflare Workers deployment via Wrangler

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Create local env vars:

```bash
cp .env.example .env.local
```

3. Start the default local dev server:

```bash
pnpm dev
```

The app runs on `http://localhost:3000`. This uses the local Node/Vite runtime with `DATABASE_URL`.

To test the Cloudflare Vite runtime locally, run:

```bash
pnpm dev:cloudflare
```

To test the deployed Worker path with the real Hyperdrive binding, run:

```bash
pnpm dev:remote
```

See `docs/LOCAL_DEV.md` for the full local runtime split.

## Environment Variables

The main env vars currently used by the app are:

- `VITE_APP_TITLE`
- `SERVER_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `DATABASE_URL`
- `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` for local Hyperdrive development
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `VITE_POSTHOG_KEY`
- `VITE_POSTHOG_HOST`

Use `.env.example` as the tracked reference. Keep real values in `.env.local`.

Recommended setup:

- Set `DATABASE_URL` to the Supabase pooler URL with `?sslmode=require` for day-to-day local development.
- Set `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` only when running `pnpm dev:cloudflare` and you need a local Hyperdrive connection override.
- Use `pnpm dev` or `pnpm dev:node` for normal local work.
- Use `pnpm dev:cloudflare` when you specifically want to exercise the local Cloudflare runtime.
- Use `pnpm dev:remote` when you specifically want to exercise the remote Cloudflare Worker runtime and Hyperdrive binding.

## Database

Generate or apply schema changes with:

```bash
pnpm db:generate
pnpm db:migrate
```

For local Drizzle commands, `drizzle.config.ts` loads `.env.local` and `.env`.

## Useful Scripts

```bash
pnpm dev
pnpm dev:cloudflare
pnpm build
pnpm test
pnpm check
pnpm deploy
```

`pnpm test` uses the Cloudflare worker test pool and needs either `DATABASE_URL` or `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` set locally.

## Git Hygiene

The repo ignores local secrets, build output, Wrangler state, TanStack generated cache, coverage output, and common local editor artifacts through `.gitignore`.
