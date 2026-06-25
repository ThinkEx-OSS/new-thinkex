import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vite-plus/test/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			// Bindings flagged `remote: true` in wrangler.jsonc (AI, EMAIL) would
			// otherwise make the pool open a remote proxy session, which needs a
			// CLOUDFLARE_API_TOKEN that CI doesn't have. Simulate them locally instead.
			remoteBindings: false,
			wrangler: {
				configPath: "./wrangler.jsonc",
			},
		}),
	],
	test: {
		include: ["src/**/*.test.ts"],
	},
});
