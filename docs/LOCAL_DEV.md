# Local Development

Use three commands. Do not set database driver flags manually.

## Normal App Work

```bash
pnpm dev
```

Use this for UI, routes, server functions, auth, Drizzle, TanStack Query, and general product work. It uses `DATABASE_URL` directly and does not run Durable Objects.

## Realtime / Worker Work

```bash
pnpm dev:cloudflare
```

Use this when you need local Cloudflare Worker behavior, especially Durable Objects and workspace presence. The script still forces direct database access through `DATABASE_URL`, so local realtime testing does not depend on Hyperdrive.

## Production-Like Hyperdrive Check

```bash
pnpm dev:hyperdrive
```

Use this rarely, only to validate the deployed Hyperdrive path. It runs through Cloudflare remote development and can touch remote resources.

Do not use this as the main presence test. Wrangler remote development currently warns that SQLite Durable Objects are local-only in remote mode. Use `pnpm dev:cloudflare` for workspace presence.

## Deploy

```bash
pnpm deploy
```

Deploy uses Hyperdrive through the `HYPERDRIVE` binding. The default Worker variable in `wrangler.jsonc` is `THINKEX_DB_DRIVER=hyperdrive`, while local dev scripts override it to direct database access.
