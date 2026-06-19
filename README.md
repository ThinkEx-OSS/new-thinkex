# ThinkEx

TanStack Start — React, Better Auth, Drizzle/Postgres, Cloudflare Workers.

```bash
pnpm install && pnpm dev   # http://localhost:3000 via Infisical
```

Local DB: Infisical `DATABASE_URL`. Production: Hyperdrive binding.

```bash
pnpm check && pnpm typecheck && pnpm build && pnpm deploy
pnpm db:generate && pnpm db:migrate
```

Secrets: Infisical locally; sync to Cloudflare for prod (`wrangler.jsonc`). `.infisical.json` is safe to commit.

### Workspace invite email (Cloudflare Email Service)

Email invites send through the Worker `EMAIL` binding (`send_email` in `wrangler.jsonc`). Production requires onboarding the ThinkEx sending domain:

```bash
npx wrangler email sending enable thinkex.app
npx wrangler email sending dns get thinkex.app
```

Set `WORKSPACE_INVITE_FROM_EMAIL` in `wrangler.jsonc` to an address on that domain (default: `invites@thinkex.app`). Local dev uses `"remote": true` on the binding so sends hit the real service — use addresses you control.

If the binding or domain is not configured, invites are still saved in the database and the share dialog reports which addresses failed to send.

**Prod:** `https://new-thinkex.chakrabortyurjit.workers.dev` — OAuth callback `/api/auth/callback/google`

**Docs:** [`CONTEXT.md`](CONTEXT.md) · [`docs/README.md`](docs/README.md) · [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`AGENTS.md`](AGENTS.md)
