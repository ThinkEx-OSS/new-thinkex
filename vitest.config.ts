import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Vitest boots the Cloudflare worker pool before app code runs, so load local
// env files here to ensure Hyperdrive's local connection string is available.
loadEnv({ path: [".env.local", ".env"] });

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: {
				configPath: "./wrangler.jsonc",
			},
		}),
	],
	test: {
		include: ["src/**/*.test.ts"],
	},
});
