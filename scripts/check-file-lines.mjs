#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const MAX_LINES = 300;
const ROOT = process.cwd();
const INCLUDED_EXTENSIONS = new Set([
	".css",
	".html",
	".json",
	".jsonc",
	".ts",
	".tsx",
]);
const INCLUDED_FILES = new Set(["package.json"]);
const EXCLUDED_DIRECTORIES = new Set([
	".git",
	".tanstack",
	"coverage",
	"dist",
	"drizzle/meta",
	"node_modules",
	"references",
]);
const EXCLUDED_FILES = new Set([
	"pnpm-lock.yaml",
	"src/routeTree.gen.ts",
	"src/styles.css",
	"worker-configuration.d.ts",
]);

function shouldSkipDirectory(name) {
	return EXCLUDED_DIRECTORIES.has(name);
}

function shouldSkipPath(path) {
	const normalizedPath = relative(ROOT, path).replaceAll("\\", "/");

	return [...EXCLUDED_DIRECTORIES].some(
		(directory) =>
			normalizedPath === directory || normalizedPath.startsWith(`${directory}/`),
	);
}

function shouldCheckFile(path) {
	const normalizedPath = relative(ROOT, path).replaceAll("\\", "/");
	const filename = normalizedPath.split("/").at(-1);

	if (!filename || EXCLUDED_FILES.has(normalizedPath)) {
		return false;
	}

	return INCLUDED_FILES.has(filename) || INCLUDED_EXTENSIONS.has(extname(path));
}

function collectFiles(directory) {
	const files = [];

	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			if (!shouldSkipDirectory(entry.name) && !shouldSkipPath(path)) {
				files.push(...collectFiles(path));
			}

			continue;
		}

		if (entry.isFile() && shouldCheckFile(path)) {
			files.push(path);
		}
	}

	return files;
}

function countLines(path) {
	const { size } = statSync(path);

	if (size === 0) {
		return 0;
	}

	const content = readFileSync(path, "utf8");
	const lineBreaks = content.match(/\n/g)?.length ?? 0;

	return content.endsWith("\n") ? lineBreaks : lineBreaks + 1;
}

const violations = collectFiles(ROOT)
	.map((path) => ({
		path,
		lines: countLines(path),
	}))
	.filter(({ lines }) => lines > MAX_LINES)
	.sort((a, b) => b.lines - a.lines);

if (violations.length > 0) {
	console.error(`Files must be ${MAX_LINES} lines or fewer:`);

	for (const violation of violations) {
		console.error(
			`  ${relative(ROOT, violation.path)}: ${violation.lines} lines`,
		);
	}

	process.exit(1);
}

console.log(`All checked files are ${MAX_LINES} lines or fewer.`);
