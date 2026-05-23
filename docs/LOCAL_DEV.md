# Local Development

ThinkEx has two local runtime modes on purpose.

## Default App Development

Use this for normal product work:

```bash
pnpm dev
```

`pnpm dev` is equivalent to `pnpm dev:node`. It runs TanStack Start through Vite in the local Node runtime and uses `DATABASE_URL`.

This is the fastest and most reliable inner loop for UI, route, server-function, auth, and Drizzle work. It avoids the local Cloudflare Workers socket path, which has been unstable with our Supabase/Postgres connection during development.

## Cloudflare Runtime Testing

Use this only when you need to test Workers-specific behavior, bindings, or runtime compatibility:

```bash
pnpm dev:cloudflare
```

This enables the Cloudflare Vite plugin with `CLOUDFLARE_DEV=true`. For local Hyperdrive testing, set:

```bash
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://...
```

Local Hyperdrive mode still connects to the configured database directly; it does not exercise Cloudflare's production Hyperdrive caching layer.

## Remote Worker Validation

Use this for production-like Cloudflare validation:

```bash
pnpm dev:remote
```

Remote dev runs against Cloudflare's remote runtime and real bindings. It is slower than local Vite dev, so it should be used as a validation step rather than the default development loop.

## Deployment

Production builds use the Cloudflare Vite plugin and deploy through Wrangler:

```bash
pnpm deploy
```

Production should use the `HYPERDRIVE` binding from `wrangler.jsonc`. Do not add a production `DATABASE_URL` Worker secret unless you intentionally want to bypass Hyperdrive.
