import { findChildren } from "@tiptap/core";
import type { Node as ProsemirrorNode } from "@tiptap/pm/model";
import {
	createHighlighterCore,
	type HighlighterGeneric,
	type LanguageInput,
	type ThemeInput,
	type ThemeRegistration,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export type SupportedCodeLanguage =
	| "astro"
	| "bash"
	| "c"
	| "css"
	| "cpp"
	| "csharp"
	| "diff"
	| "docker"
	| "dotenv"
	| "dart"
	| "go"
	| "graphql"
	| "hcl"
	| "html"
	| "ini"
	| "java"
	| "javascript"
	| "json"
	| "jsonc"
	| "jsx"
	| "kotlin"
	| "lua"
	| "make"
	| "markdown"
	| "mdx"
	| "php"
	| "powershell"
	| "python"
	| "r"
	| "ruby"
	| "rust"
	| "shellscript"
	| "sql"
	| "svelte"
	| "swift"
	| "terraform"
	| "toml"
	| "tsx"
	| "typescript"
	| "vue"
	| "xml"
	| "yaml";
export type SupportedCodeTheme = "github-dark" | "github-light";
export type CodeLanguageOption = {
	label: string;
	value: SupportedCodeLanguage;
};

type WorkspaceDocumentHighlighter = HighlighterGeneric<SupportedCodeLanguage, SupportedCodeTheme>;
type LanguageModule = { default: LanguageInput };
type ThemeModule = { default: ThemeInput };
type HighlighterOptions = {
	customThemes?: ThemeRegistration[];
	languages: (string | null | undefined)[];
	themes: SupportedCodeTheme[];
};

const languageAliases: Partial<Record<string, SupportedCodeLanguage>> = {
	".env": "dotenv",
	"c++": "cpp",
	csharp: "csharp",
	cs: "csharp",
	dockerfile: "docker",
	env: "dotenv",
	gql: "graphql",
	js: "javascript",
	kt: "kotlin",
	kts: "kotlin",
	makefile: "make",
	md: "markdown",
	ps: "powershell",
	ps1: "powershell",
	py: "python",
	shell: "shellscript",
	sh: "shellscript",
	tf: "terraform",
	tfvars: "terraform",
	ts: "typescript",
	yml: "yaml",
};
export const codeLanguageOptions: CodeLanguageOption[] = [
	{ label: "JavaScript", value: "javascript" },
	{ label: "TypeScript", value: "typescript" },
	{ label: "TSX", value: "tsx" },
	{ label: "JSX", value: "jsx" },
	{ label: "JSON", value: "json" },
	{ label: "JSONC", value: "jsonc" },
	{ label: "HTML", value: "html" },
	{ label: "CSS", value: "css" },
	{ label: "Markdown", value: "markdown" },
	{ label: "MDX", value: "mdx" },
	{ label: "Shell", value: "shellscript" },
	{ label: "Bash", value: "bash" },
	{ label: "PowerShell", value: "powershell" },
	{ label: "Python", value: "python" },
	{ label: "SQL", value: "sql" },
	{ label: "GraphQL", value: "graphql" },
	{ label: "YAML", value: "yaml" },
	{ label: "TOML", value: "toml" },
	{ label: ".env", value: "dotenv" },
	{ label: "INI", value: "ini" },
	{ label: "Dockerfile", value: "docker" },
	{ label: "Terraform", value: "terraform" },
	{ label: "HCL", value: "hcl" },
	{ label: "XML", value: "xml" },
	{ label: "Go", value: "go" },
	{ label: "Rust", value: "rust" },
	{ label: "Java", value: "java" },
	{ label: "C", value: "c" },
	{ label: "C++", value: "cpp" },
	{ label: "C#", value: "csharp" },
	{ label: "Kotlin", value: "kotlin" },
	{ label: "Swift", value: "swift" },
	{ label: "Dart", value: "dart" },
	{ label: "PHP", value: "php" },
	{ label: "Ruby", value: "ruby" },
	{ label: "Lua", value: "lua" },
	{ label: "R", value: "r" },
	{ label: "Vue", value: "vue" },
	{ label: "Svelte", value: "svelte" },
	{ label: "Astro", value: "astro" },
	{ label: "Makefile", value: "make" },
	{ label: "Diff", value: "diff" },
];
const languageLoaders: Record<SupportedCodeLanguage, () => Promise<LanguageModule>> = {
	astro: () => import("shiki/langs/astro.mjs"),
	bash: () => import("shiki/langs/bash.mjs"),
	c: () => import("shiki/langs/c.mjs"),
	css: () => import("shiki/langs/css.mjs"),
	cpp: () => import("shiki/langs/cpp.mjs"),
	csharp: () => import("shiki/langs/csharp.mjs"),
	dart: () => import("shiki/langs/dart.mjs"),
	diff: () => import("shiki/langs/diff.mjs"),
	docker: () => import("shiki/langs/docker.mjs"),
	dotenv: () => import("shiki/langs/dotenv.mjs"),
	go: () => import("shiki/langs/go.mjs"),
	graphql: () => import("shiki/langs/graphql.mjs"),
	hcl: () => import("shiki/langs/hcl.mjs"),
	html: () => import("shiki/langs/html.mjs"),
	ini: () => import("shiki/langs/ini.mjs"),
	java: () => import("shiki/langs/java.mjs"),
	javascript: () => import("shiki/langs/javascript.mjs"),
	json: () => import("shiki/langs/json.mjs"),
	jsonc: () => import("shiki/langs/jsonc.mjs"),
	jsx: () => import("shiki/langs/jsx.mjs"),
	kotlin: () => import("shiki/langs/kotlin.mjs"),
	lua: () => import("shiki/langs/lua.mjs"),
	make: () => import("shiki/langs/make.mjs"),
	markdown: () => import("shiki/langs/markdown.mjs"),
	mdx: () => import("shiki/langs/mdx.mjs"),
	php: () => import("shiki/langs/php.mjs"),
	powershell: () => import("shiki/langs/powershell.mjs"),
	python: () => import("shiki/langs/python.mjs"),
	r: () => import("shiki/langs/r.mjs"),
	ruby: () => import("shiki/langs/ruby.mjs"),
	rust: () => import("shiki/langs/rust.mjs"),
	shellscript: () => import("shiki/langs/shellscript.mjs"),
	sql: () => import("shiki/langs/sql.mjs"),
	svelte: () => import("shiki/langs/svelte.mjs"),
	swift: () => import("shiki/langs/swift.mjs"),
	terraform: () => import("shiki/langs/terraform.mjs"),
	toml: () => import("shiki/langs/toml.mjs"),
	tsx: () => import("shiki/langs/tsx.mjs"),
	typescript: () => import("shiki/langs/typescript.mjs"),
	vue: () => import("shiki/langs/vue.mjs"),
	xml: () => import("shiki/langs/xml.mjs"),
	yaml: () => import("shiki/langs/yaml.mjs"),
};
const themeLoaders: Record<SupportedCodeTheme, () => Promise<ThemeModule>> = {
	"github-dark": () => import("shiki/themes/github-dark.mjs"),
	"github-light": () => import("shiki/themes/github-light.mjs"),
};

let highlighter: WorkspaceDocumentHighlighter | undefined;
let highlighterPromise: Promise<void> | undefined;
const loadingLanguages = new Set<SupportedCodeLanguage>();
const loadingThemes = new Set<SupportedCodeTheme>();
const customThemeRegistry = new Map<string, ThemeRegistration>();

export function getShiki() {
	return highlighter;
}

export function normalizeCodeLanguage(
	language: string | null | undefined,
): SupportedCodeLanguage | null {
	if (!language) {
		return null;
	}

	const normalized = language.trim().toLowerCase();

	if (normalized in languageLoaders) {
		return normalized as SupportedCodeLanguage;
	}

	return languageAliases[normalized] ?? null;
}

export function getCodeLanguageLabel(language: string | null | undefined) {
	const normalizedLanguage = normalizeCodeLanguage(language);
	const option = codeLanguageOptions.find((candidate) => candidate.value === normalizedLanguage);

	return option?.label ?? "Code";
}

function registerCustomThemes(customThemes?: ThemeRegistration[]) {
	if (!customThemes) {
		return;
	}

	for (const theme of customThemes) {
		if (theme.name) {
			customThemeRegistry.set(theme.name, theme);
		}
	}
}

async function loadConfiguredTheme(theme: SupportedCodeTheme) {
	if (!highlighter || highlighter.getLoadedThemes().includes(theme)) {
		return false;
	}

	if (loadingThemes.has(theme)) {
		return false;
	}

	loadingThemes.add(theme);
	try {
		const themeModule = await themeLoaders[theme]();
		await highlighter.loadTheme(themeModule.default);
		return true;
	} finally {
		loadingThemes.delete(theme);
	}
}

async function createWorkspaceDocumentHighlighter(opts: HighlighterOptions) {
	const themes = await Promise.all(
		opts.themes.map(async (theme) => {
			const themeModule = await themeLoaders[theme]();
			return themeModule.default;
		}),
	);

	const instance = await createHighlighterCore({
		engine: createJavaScriptRegexEngine(),
		langs: [],
		themes: [...themes, ...customThemeRegistry.values()],
	});
	highlighter = instance as WorkspaceDocumentHighlighter;
}

async function loadHighlighter(opts: HighlighterOptions) {
	registerCustomThemes(opts.customThemes);

	if (!highlighter && !highlighterPromise) {
		highlighterPromise = createWorkspaceDocumentHighlighter(opts).catch((error) => {
			highlighterPromise = undefined;
			throw error;
		});
		await highlighterPromise;
		await Promise.all(opts.languages.map((language) => loadLanguage(language)));
		return true;
	}

	await highlighterPromise;
	const loadStates = await Promise.all([
		...opts.themes.map((theme) => loadConfiguredTheme(theme)),
		...opts.languages.map((language) => loadLanguage(language)),
	]);

	return loadStates.includes(true);
}

export async function loadLanguage(language: string | null | undefined) {
	const supportedLanguage = normalizeCodeLanguage(language);

	if (!highlighter || !supportedLanguage) {
		return false;
	}

	if (
		highlighter.getLoadedLanguages().includes(supportedLanguage) ||
		loadingLanguages.has(supportedLanguage)
	) {
		return false;
	}

	loadingLanguages.add(supportedLanguage);
	try {
		const languageModule = await languageLoaders[supportedLanguage]();
		await highlighter.loadLanguage(languageModule.default);
		return true;
	} finally {
		loadingLanguages.delete(supportedLanguage);
	}
}

export async function initHighlighter({
	customThemes,
	defaultLanguage,
	doc,
	name,
	themes,
}: {
	customThemes?: ThemeRegistration[];
	defaultLanguage: string | null | undefined;
	doc: ProsemirrorNode;
	name: string;
	themes: {
		dark: SupportedCodeTheme;
		light: SupportedCodeTheme;
	};
}) {
	const codeBlocks = findChildren(doc, (node) => node.type.name === name);
	const languages = [
		...codeBlocks.map((block) => block.node.attrs.language as string),
		defaultLanguage,
	];

	return loadHighlighter({
		customThemes,
		languages,
		themes: [themes.light, themes.dark],
	});
}
