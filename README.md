# ThinkEx

TanStack Start — React, Better Auth, Drizzle, D1, Cloudflare Workers.

```bash
pnpm install && pnpm dev   # http://localhost:3000 via Infisical
```

App database: Cloudflare D1. Local dev uses the local D1 binding automatically; deployments use the `DB` binding in `wrangler.jsonc`.

### Database layout

| Environment | Provider | How the app connects |
|-------------|----------|----------------------|
| Local dev | local D1 | auto-wired `DB` binding via `pnpm dev` |
| Deployment | remote D1 | `DB` binding in `wrangler.jsonc` |

Fresh setup: create the remote database once with `wrangler d1 create new-thinkex`, then paste the returned `database_id` into `wrangler.jsonc`.

### Schema changes (Drizzle)

One shared `drizzle/` migration folder. Generate SQL with Drizzle, then apply it to local and remote D1 with Wrangler.

```bash
# 1. Edit src/db/schema.ts, then generate SQL (review the new file in drizzle/)
pnpm db:generate
pnpm db:check

# 2. Apply locally, then test with pnpm dev
pnpm db:migrate:local

# 3. Apply to remote D1, then deploy
pnpm db:migrate
pnpm deploy
```

Rules:

- Use **`db:generate` + Wrangler migrations**. Do not hand-edit remote schema.
- Always migrate **local first**, then **remote**, then deploy.
- Commit the `drizzle/` folder with schema changes.
- The app no longer needs `DATABASE_URL` for its primary database.

```bash
pnpm check && pnpm typecheck && pnpm build && pnpm deploy
pnpm db:generate && pnpm db:migrate:local && pnpm db:migrate
```

Secrets still come from Infisical locally and Cloudflare bindings in production. `.infisical.json` is safe to commit.

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
