import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					environment: "node",
					include: ["src/**/*.unit.test.ts"],
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
					exclude: ["src/**/*.unit.test.ts"],
				},
			},
		],
	},
});
