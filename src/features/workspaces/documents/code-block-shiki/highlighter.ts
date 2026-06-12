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
	| "bash"
	| "css"
	| "csharp"
	| "diff"
	| "go"
	| "graphql"
	| "html"
	| "java"
	| "javascript"
	| "json"
	| "jsx"
	| "markdown"
	| "php"
	| "python"
	| "ruby"
	| "rust"
	| "shellscript"
	| "sql"
	| "svelte"
	| "tsx"
	| "typescript"
	| "vue"
	| "yaml";
export type SupportedCodeTheme = "github-dark" | "github-light";
export type CodeLanguageOption = {
	label: string;
	value: SupportedCodeLanguage;
};

type WorkspaceDocumentHighlighter = HighlighterGeneric<
	SupportedCodeLanguage,
	SupportedCodeTheme
>;
type LanguageModule = { default: LanguageInput };
type ThemeModule = { default: ThemeInput };
type HighlighterOptions = {
	customThemes?: ThemeRegistration[];
	languages: (string | null | undefined)[];
	themes: SupportedCodeTheme[];
};

const languageAliases: Partial<Record<string, SupportedCodeLanguage>> = {
	csharp: "csharp",
	cs: "csharp",
	gql: "graphql",
	js: "javascript",
	md: "markdown",
	py: "python",
	sh: "shellscript",
	ts: "typescript",
	yml: "yaml",
};
export const codeLanguageOptions: CodeLanguageOption[] = [
	{ label: "JavaScript", value: "javascript" },
	{ label: "TypeScript", value: "typescript" },
	{ label: "TSX", value: "tsx" },
	{ label: "JSX", value: "jsx" },
	{ label: "JSON", value: "json" },
	{ label: "HTML", value: "html" },
	{ label: "CSS", value: "css" },
	{ label: "Markdown", value: "markdown" },
	{ label: "Shell", value: "shellscript" },
	{ label: "Python", value: "python" },
	{ label: "SQL", value: "sql" },
	{ label: "GraphQL", value: "graphql" },
	{ label: "YAML", value: "yaml" },
	{ label: "Go", value: "go" },
	{ label: "Rust", value: "rust" },
	{ label: "Java", value: "java" },
	{ label: "C#", value: "csharp" },
	{ label: "PHP", value: "php" },
	{ label: "Ruby", value: "ruby" },
	{ label: "Vue", value: "vue" },
	{ label: "Svelte", value: "svelte" },
	{ label: "Diff", value: "diff" },
	{ label: "Bash", value: "bash" },
];
const languageLoaders: Record<
	SupportedCodeLanguage,
	() => Promise<LanguageModule>
> = {
	bash: () => import("shiki/langs/bash.mjs"),
	css: () => import("shiki/langs/css.mjs"),
	csharp: () => import("shiki/langs/csharp.mjs"),
	diff: () => import("shiki/langs/diff.mjs"),
	go: () => import("shiki/langs/go.mjs"),
	graphql: () => import("shiki/langs/graphql.mjs"),
	html: () => import("shiki/langs/html.mjs"),
	java: () => import("shiki/langs/java.mjs"),
	javascript: () => import("shiki/langs/javascript.mjs"),
	json: () => import("shiki/langs/json.mjs"),
	jsx: () => import("shiki/langs/jsx.mjs"),
	markdown: () => import("shiki/langs/markdown.mjs"),
	php: () => import("shiki/langs/php.mjs"),
	python: () => import("shiki/langs/python.mjs"),
	ruby: () => import("shiki/langs/ruby.mjs"),
	rust: () => import("shiki/langs/rust.mjs"),
	shellscript: () => import("shiki/langs/shellscript.mjs"),
	sql: () => import("shiki/langs/sql.mjs"),
	svelte: () => import("shiki/langs/svelte.mjs"),
	tsx: () => import("shiki/langs/tsx.mjs"),
	typescript: () => import("shiki/langs/typescript.mjs"),
	vue: () => import("shiki/langs/vue.mjs"),
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
	const option = codeLanguageOptions.find(
		(candidate) => candidate.value === normalizedLanguage,
	);

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
		highlighterPromise = createWorkspaceDocumentHighlighter(opts).catch(
			(error) => {
				highlighterPromise = undefined;
				throw error;
			},
		);
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
