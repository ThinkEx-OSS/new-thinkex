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

3. Start the dev server:

```bash
pnpm dev
```

The app runs on `http://localhost:3000`.

To test the deployed Worker path with the real Hyperdrive binding, run:

```bash
pnpm dev:remote
```

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
- Set `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` to the same local-development database URL when running `pnpm dev`. Wrangler requires this because the project declares a `HYPERDRIVE` binding, even though local development still connects directly to the database.
- Use `pnpm dev` for normal local work.
- Use `pnpm dev:remote` when you specifically want to exercise the Cloudflare Worker runtime and Hyperdrive binding.

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
pnpm build
pnpm test
pnpm check
pnpm deploy
```

`pnpm test` uses the Cloudflare worker test pool and needs either `DATABASE_URL` or `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` set locally.

## Git Hygiene

The repo ignores local secrets, build output, Wrangler state, TanStack generated cache, coverage output, and common local editor artifacts through `.gitignore`.
