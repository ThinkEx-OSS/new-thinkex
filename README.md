# ThinkEx

TanStack Start — React, Better Auth, Drizzle, D1, Cloudflare Workers.

```bash
pnpm install && pnpm dev   # http://localhost:3000 via Infisical
```

App database: Cloudflare D1. Local dev uses the local D1 binding automatically; deployments use the `DB` binding in `wrangler.jsonc`.

### Database layout

| Environment | Provider  | How the app connects                            |
| ----------- | --------- | ----------------------------------------------- |
| Local dev   | local D1  | auto-wired `DB` binding via `pnpm dev`          |
| Staging     | remote D1 | `DB` binding via `wrangler.jsonc > env.staging` |
| Production  | remote D1 | top-level `DB` binding in `wrangler.jsonc`      |

Provisioned remote resources:

- Production D1: `thinkex`
- Staging D1: `thinkex-staging`
- Production R2: `thinkex-workspace-kernel-files`
- Staging R2: `thinkex-workspace-kernel-files-staging`

### Schema changes (Drizzle)

One shared `drizzle/` migration folder. Generate SQL with Drizzle, then apply it to local and remote D1 with Wrangler.

```bash
# 1. Edit src/db/schema.ts, then generate SQL (review the new file in drizzle/)
pnpm db:generate
pnpm db:check

# 2. Apply locally, then test with pnpm dev
pnpm db:migrate:local

# 3. Apply to remote D1, then deploy
pnpm db:migrate:staging
pnpm deploy:staging

# 4. Repeat for production
pnpm db:migrate
pnpm deploy
```

Rules:

- Use **`db:generate` + Wrangler migrations**. Do not hand-edit remote schema.
- Always migrate **local first**, then **remote**, then deploy.
- Commit the `drizzle/` folder with schema changes.
- The app no longer needs `DATABASE_URL` for its primary database.

```bash
pnpm check && pnpm test && pnpm build
pnpm db:generate && pnpm db:migrate:local
```

Secrets still come from Infisical locally and Cloudflare Worker secrets remotely. `.infisical.json` is safe to commit.

### Vite+

This repo now uses Vite+ for the local Vite/Vitest/lint/format command surface while keeping Wrangler and Infisical in place.

- Use `pnpm dev`, `pnpm build`, `pnpm preview`, `pnpm test`, `pnpm lint`, `pnpm format`, and `pnpm check` as usual; those scripts now delegate to local `vp` commands.
- `pnpm check` runs Oxfmt, Oxlint, and TypeScript type checks together via `vp check` (no separate `tsgo` / `tsc` script).
- Git hooks now run through Vite+ (`vp config` + `vp staged`) instead of Lefthook.
- If you want to run `vp ...` directly in your shell outside package scripts, install the global CLI with `curl -fsSL https://vite.plus | bash`.

Remote secrets must be set separately for each Wrangler environment:

```bash
wrangler secret put BETTER_AUTH_URL --env staging
wrangler secret put BETTER_AUTH_URL --env production
```

Repeat that for:

- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FIRECRAWL_API_KEY`
- `AI_GATEWAY_API_KEY`

Because this app uses the Cloudflare Vite plugin, the Cloudflare environment for deploys is chosen at build time with `CLOUDFLARE_ENV`, not by passing `--env` to `wrangler deploy`. Use the package scripts above instead of calling `wrangler deploy --env staging` directly.

### PostHog (analytics + replay)

The app uses the PostHog web SDK on the client for analytics and session replay.

- Set `VITE_POSTHOG_PROJECT_TOKEN` to your PostHog project token.
- Set `VITE_POSTHOG_HOST` to your PostHog reverse proxy host, for example `https://h.thinkex.app`.

These are public client-side values, so they must be available at build time anywhere `pnpm dev`, `pnpm build`, or `pnpm deploy` runs.

For staging and production builds, browser error tracking sourcemaps are uploaded with the official PostHog Rollup plugin.

- Set `POSTHOG_API_KEY` to a PostHog personal API key with sourcemap upload access.
- Set `POSTHOG_PROJECT_ID` to the PostHog project ID.
- Optionally set `POSTHOG_HOST` if you need a non-default PostHog API host.

These are private build-time secrets. Keep them in Infisical and CI, but do not sync them to Cloudflare Worker runtime secrets.

PostHog project settings still need exception autocapture enabled for automatic browser `$exception` capture.

### CI/CD

GitHub Actions workflows live in `.github/workflows`:

- `ci.yml` runs `pnpm check`, `pnpm test`, and `pnpm build`
- `deploy-staging.yml` migrates and deploys the `staging` branch to Cloudflare
- `deploy-production.yml` migrates and deploys the `main` branch to Cloudflare

The deploy workflows expect these GitHub environment secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `VITE_POSTHOG_HOST`
- `VITE_POSTHOG_PROJECT_TOKEN`
- `POSTHOG_API_KEY`
- `POSTHOG_PROJECT_ID`
- optional `POSTHOG_HOST`

### Workspace invite email (Cloudflare Email Service)

Email invites send through the Worker `EMAIL` binding (`send_email` in `wrangler.jsonc`). Production requires onboarding the ThinkEx sending domain:

```bash
npx wrangler email sending enable thinkex.app
npx wrangler email sending dns get thinkex.app
```

Set `WORKSPACE_INVITE_FROM_EMAIL` in `wrangler.jsonc` to an address on that domain (default: `invites@thinkex.app`). Local dev uses `"remote": true` on the binding so sends hit the real service — use addresses you control.

If the binding or domain is not configured, invites are still saved in the database and the share dialog reports which addresses failed to send.

**Prod:** `https://thinkex.chakrabortyurjit.workers.dev` — OAuth callback `/api/auth/callback/google`

**Docs:** [`CONTEXT.md`](CONTEXT.md) · [`docs/README.md`](docs/README.md) · [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`AGENTS.md`](AGENTS.md)
