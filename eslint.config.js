import reactCompiler from "eslint-plugin-react-compiler";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			"dist/**",
			".analyze/**",
			"../new-thinkex-references/**",
			"src/routeTree.gen.ts",
			"worker-configuration.d.ts",
		],
	},
	{
		files: ["*.{ts,tsx}"],
		extends: [tseslint.configs.base],
	},
	{
		files: ["src/**/*.{ts,tsx}"],
		ignores: ["src/components/ui/**"],
		extends: [tseslint.configs.base],
		plugins: {
			"react-compiler": reactCompiler,
		},
		rules: {
			"react-compiler/react-compiler": "error",
		},
	},
);
