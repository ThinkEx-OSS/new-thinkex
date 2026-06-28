# Environment

ThinkEx reads runtime configuration from Cloudflare Worker bindings, environment variables, and local `.dev.vars` files. Infisical is the source of truth for shared secrets.

## Local Development

Use `pnpm dev` for normal local development. It injects Infisical `dev:/app` secrets and starts the dev server.

Use `pnpm serve:dev` when the environment is already present, such as after a cloud setup script writes `.dev.vars`.

## Secret Paths

| Path | Purpose |
| --- | --- |
| `dev:/app` | Normal local developer secrets |
| `dev:/agents` | Sandbox secrets for hosted agent/dev-server environments |

Cloud agents should not use production credentials, deploy tokens, migration tokens, or legacy database credentials unless a task explicitly requires them.

## Runtime Sync

Cloudflare Worker secrets are synced from Infisical for deployed environments. Local and hosted-agent dev servers should use Infisical-injected environment variables or a generated, gitignored `.dev.vars` file.

Auth uses `BETTER_AUTH_URL` as the canonical production origin. Development and preview hosts can be allowed with `BETTER_AUTH_ALLOWED_HOSTS`, for example `localhost:*,127.0.0.1:*`.

## Agent Authentication

The product login UI currently sends users through Google. Hosted agents that need a session can use the Better Auth anonymous endpoint directly against a dev server:

```bash
curl -i -X POST "$APP_ORIGIN/api/auth/sign-in/anonymous"
```

Keep the returned cookies in the browser or HTTP client used for follow-up requests. Anonymous auth is installed for automation and future onboarding work; it is not a visible end-user sign-in option.

Core runtime names:

- `BETTER_AUTH_URL` - canonical app origin for production and outbound links
- `BETTER_AUTH_ALLOWED_HOSTS` - development/preview host allowlist
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FIRECRAWL_API_KEY`
- `LLAMA_CLOUD_API_KEY`
- `AI_GATEWAY_API_KEY`
- `VITE_POSTHOG_HOST`
- `VITE_POSTHOG_PROJECT_TOKEN`
- `POSTHOG_API_KEY`
- `POSTHOG_PROJECT_ID`
