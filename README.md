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

**Prod:** `https://new-thinkex.chakrabortyurjit.workers.dev` — OAuth callback `/api/auth/callback/google`

**Docs:** [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`AGENTS.md`](AGENTS.md) · [`references.md`](docs/references.md)
