import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vite-plus/test/config";

// Pure unit tests that do not touch Worker bindings (D1/R2/Durable Objects)
// run in a plain Node environment. Everything else runs in the Cloudflare
// Workers pool, which boots Miniflare/wrangler bindings.
const nodeTestGlobs = ["src/features/workspaces/migration/**/*.test.ts"];

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "node",
					environment: "node",
					include: nodeTestGlobs,
				},
			},
			{
				plugins: [
					cloudflareTest({
						wrangler: {
							configPath: "./wrangler.jsonc",
						},
					}),
				],
				test: {
					name: "workers",
					include: ["src/**/*.test.ts"],
					exclude: nodeTestGlobs,
				},
			},
		],
	},
});
