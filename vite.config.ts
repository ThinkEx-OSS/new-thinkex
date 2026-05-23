import { cloudflare } from "@cloudflare/vite-plugin";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig(({ command }) => {
	const useCloudflareRuntime =
		command === "build" || process.env.CLOUDFLARE_DEV === "true";

	return {
		resolve: { tsconfigPaths: true },
		plugins: [
			devtools(),
			useCloudflareRuntime
				? cloudflare({ viteEnvironment: { name: "ssr" } })
				: null,
			tailwindcss(),
			tanstackStart({
				importProtection: {
					behavior: "error",
					client: {
						specifiers: ["pg", "drizzle-orm/node-postgres"],
						files: ["src/db/**", "src/lib/auth.server.ts"],
					},
				},
			}),
			viteReact(),
			babel({ presets: [reactCompilerPreset()] }),
		],
	};
});

export default config;
