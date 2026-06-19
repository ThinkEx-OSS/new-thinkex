# ThinkEx

TanStack Start — React, Better Auth, Drizzle/Postgres, Cloudflare Workers.

```bash
pnpm install && pnpm dev   # http://localhost:3000 via Infisical
```

Local DB: Infisical `DATABASE_URL` (Neon dev). Production Worker: Hyperdrive → PlanetScale `main`.

### Database layout

| Environment | Provider | How the app connects |
|-------------|----------|----------------------|
| Local dev | Neon dev branch | Infisical **dev** `DATABASE_URL` |
| Production Worker | PlanetScale `main` | `HYPERDRIVE` binding in `wrangler.jsonc` |
| Prod migrations (CLI only) | PlanetScale `main` | Infisical **prod** `DATABASE_URL` (direct Postgres URL, not Hyperdrive) |

Add PlanetScale’s direct connection string to Infisical **prod** as `DATABASE_URL` for `pnpm db:migrate:prod` only. The deployed Worker connects via the `HYPERDRIVE` binding (not Infisical `DATABASE_URL`).

### Schema changes (Drizzle)

One shared `drizzle/` migration folder. Generate once, apply the same SQL files to both databases ([Drizzle multi-env guidance](https://orm.drizzle.team/docs/drizzle-kit-migrate#multiple-configuration-files-in-one-project)).

```bash
# 1. Edit src/db/schema.ts, then generate SQL (review the new file in drizzle/)
pnpm db:generate
pnpm db:check

# 2. Apply to Neon dev, test locally
pnpm db:migrate

# 3. Apply to PlanetScale prod, then deploy
pnpm db:migrate:prod
pnpm deploy
```

Rules:

- Use **`db:generate` + `db:migrate`** everywhere. Do not use `db:push` on prod (bypasses migration history).
- Always migrate **dev first**, then **prod**, then deploy.
- Commit the `drizzle/` folder with schema changes.
- First-time PlanetScale setup: run `pnpm db:migrate:prod` once to bootstrap `main`.

```bash
pnpm check && pnpm typecheck && pnpm build && pnpm deploy
pnpm db:generate && pnpm db:migrate && pnpm db:migrate:prod
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
