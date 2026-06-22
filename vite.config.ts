import { cloudflare } from "@cloudflare/vite-plugin";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import agents from "agents/vite";
import { defineConfig } from "vite";
import { analyzer } from "vite-bundle-analyzer";

export default defineConfig(({ command }) => ({
	resolve: { tsconfigPaths: true },
	plugins: [
		...(command === "serve" ? [devtools()] : []),
		...(process.env.ANALYZE === "true"
			? [
					analyzer({
						analyzerMode: "static",
						fileName: ".analyze/stats",
						openAnalyzer: true,
						summary: true,
					}),
				]
			: []),
		agents(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		tanstackStart({
			importProtection: {
				behavior: "error",
				client: {
					specifiers: ["cloudflare:workers", "drizzle-orm/d1"],
					files: ["src/db/**", "src/lib/auth.server.ts"],
				},
			},
		}),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
	],
}));
