#!/usr/bin/env tsx
/* eslint-disable */
// @ts-nocheck
/**
 * Legacy ThinkEx → new ThinkEx single-user migration CLI.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-user.ts --user <email|id>
 *
 * Required env vars:
 *   LEGACY_DATABASE_URL        — Postgres connection string for the old ThinkEx DB
 *   LEGACY_SUPABASE_URL        — e.g. https://uxcoymwbfcbvkgwbhttq.supabase.co
 *   LEGACY_SUPABASE_SERVICE_KEY — Supabase service-role key for file downloads
 *   MIGRATION_IMPORT_SECRET    — must match the secret set on the Worker
 *   MIGRATION_IMPORT_URL       — defaults to http://localhost:8787
 */

import postgres from "postgres";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const LEGACY_DATABASE_URL = requireEnv("LEGACY_DATABASE_URL");
const LEGACY_SUPABASE_URL = requireEnv("LEGACY_SUPABASE_URL");
const LEGACY_SUPABASE_SERVICE_KEY = requireEnv("LEGACY_SUPABASE_SERVICE_KEY");
const MIGRATION_IMPORT_SECRET = requireEnv("MIGRATION_IMPORT_SECRET");
const MIGRATION_IMPORT_URL = process.env.MIGRATION_IMPORT_URL || "http://localhost:8787";

const args = process.argv.slice(2);
const userArgIdx = args.indexOf("--user");

if (userArgIdx === -1 || !args[userArgIdx + 1]) {
	console.error("Usage: pnpm tsx scripts/migrate-user.ts --user <email|id>");
	process.exit(1);
}

const userQuery = args[userArgIdx + 1]!;

/* ------------------------------------------------------------------ */
/*  Legacy types                                                       */
/* ------------------------------------------------------------------ */

interface LegacyUser {
	id: string;
	name: string;
	email: string;
	email_verified: boolean;
	image: string | null;
	created_at: Date;
	updated_at: Date;
}

interface LegacyAccount {
	id: string;
	account_id: string;
	provider_id: string;
	user_id: string;
	access_token: string | null;
	refresh_token: string | null;
	id_token: string | null;
	scope: string | null;
	created_at: Date;
	updated_at: Date;
}

interface LegacyWorkspace {
	id: string;
	user_id: string;
	name: string;
	description: string | null;
	icon: string | null;
	color: string | null;
	last_opened_at: Date | null;
	created_at: Date;
	updated_at: Date;
}

interface LegacyWorkspaceItem {
	id: string;
	workspace_id: string;
	item_id: string;
	type: string;
	name: string;
	color: string | null;
	folder_id: string | null;
	sort_order: number | null;
}

interface LegacyItemContent {
	item_id: string;
	text_content: string | null;
	structured_data: Record<string, unknown> | null;
	asset_data: Record<string, unknown> | null;
	embed_data: Record<string, unknown> | null;
	source_data: unknown;
}

interface LegacyItemExtracted {
	item_id: string;
	ocr_pages: LegacyOcrPageRaw[] | null;
	ocr_text: string | null;
}

interface LegacyOcrPageRaw {
	index: number;
	markdown: string;
	header?: string;
	footer?: string;
	tables?: unknown;
	hyperlinks?: unknown;
}

/* ------------------------------------------------------------------ */
/*  Color + icon normalization (inline copies for CLI independence)     */
/* ------------------------------------------------------------------ */

const WORKSPACE_COLOR_VALUES = [
	"red-soft",
	"red",
	"red-bold",
	"red-deep",
	"orange-soft",
	"orange",
	"orange-bold",
	"orange-deep",
	"amber-soft",
	"amber",
	"amber-bold",
	"amber-deep",
	"emerald-soft",
	"emerald",
	"emerald-bold",
	"emerald-deep",
	"teal-soft",
	"teal",
	"teal-bold",
	"teal-deep",
	"sky-soft",
	"sky",
	"sky-bold",
	"sky-deep",
	"violet-soft",
	"violet",
	"violet-bold",
	"violet-deep",
	"rose-soft",
	"rose",
	"rose-bold",
	"rose-deep",
] as const;

type WorkspaceColor = (typeof WORKSPACE_COLOR_VALUES)[number];

const WORKSPACE_ICON_VALUES = [
	"book-marked",
	"book-open",
	"book-open-text",
	"book-search",
	"graduation-cap",
	"library-big",
	"school",
	"notebook-pen",
	"notebook-tabs",
	"highlighter",
	"file-text",
	"file-chart-column",
	"folder-open",
	"folder-search",
	"archive",
	"clipboard-list",
	"kanban",
	"list-todo",
	"presentation",
	"calendar-days",
	"clock-3",
	"target",
	"lightbulb",
	"brain",
	"brain-circuit",
	"compass",
	"map",
	"globe-2",
	"languages",
	"scroll-text",
	"newspaper",
	"palette",
	"swatch-book",
	"pen-tool",
	"pencil-ruler",
	"music",
	"audio-lines",
	"mic",
	"headphones",
	"camera",
	"video",
	"theater",
	"scale",
	"gavel",
	"vote",
	"landmark",
	"message-square-text",
	"users",
	"helping-hand",
	"handshake",
	"hand-coins",
	"briefcase-business",
	"building-2",
	"chart-column",
	"chart-line",
	"chart-scatter",
	"chart-gantt",
	"chart-pie",
	"banknote",
	"piggy-bank",
	"receipt-text",
	"megaphone",
	"wallet-cards",
	"store",
	"factory",
	"truck",
	"package",
	"shield-check",
	"search-check",
	"atom",
	"orbit",
	"magnet",
	"flask-conical",
	"test-tube-diagonal",
	"microscope",
	"activity",
	"dna",
	"sigma",
	"calculator",
	"ruler",
	"drafting-compass",
	"cpu",
	"circuit-board",
	"binary",
	"database",
	"bot",
	"code-2",
	"wrench",
	"stethoscope",
	"hospital",
	"heart-pulse",
	"pill",
	"pill-bottle",
	"leaf",
	"sprout",
	"earth",
	"waves",
	"droplet",
	"thermometer",
	"flame",
	"mountain",
	"cloud-sun",
	"telescope",
	"rocket",
	"satellite",
	"zap",
] as const;

type WorkspaceIcon = (typeof WORKSPACE_ICON_VALUES)[number];

const iconSet = new Set<string>(WORKSPACE_ICON_VALUES);

const hueBuckets = [
	{ hue: "red", minHue: 345, maxHue: 360 },
	{ hue: "red", minHue: 0, maxHue: 15 },
	{ hue: "orange", minHue: 15, maxHue: 35 },
	{ hue: "amber", minHue: 35, maxHue: 65 },
	{ hue: "emerald", minHue: 65, maxHue: 170 },
	{ hue: "teal", minHue: 170, maxHue: 195 },
	{ hue: "sky", minHue: 195, maxHue: 250 },
	{ hue: "violet", minHue: 250, maxHue: 310 },
	{ hue: "rose", minHue: 310, maxHue: 345 },
];

const namedColorHexMap: Record<string, string> = {
	red: "#ef4444",
	orange: "#f97316",
	amber: "#f59e0b",
	yellow: "#eab308",
	lime: "#84cc16",
	green: "#22c55e",
	emerald: "#10b981",
	teal: "#14b8a6",
	cyan: "#06b6d4",
	sky: "#0ea5e9",
	blue: "#3b82f6",
	indigo: "#6366f1",
	violet: "#8b5cf6",
	purple: "#a855f7",
	fuchsia: "#d946ef",
	pink: "#ec4899",
	rose: "#f43f5e",
	slate: "#64748b",
	gray: "#6b7280",
	grey: "#6b7280",
	zinc: "#71717a",
	neutral: "#737373",
	stone: "#78716c",
	black: "#000000",
	white: "#ffffff",
};

const colorSet = new Set<string>(WORKSPACE_COLOR_VALUES);

function normalizeLegacyColor(legacyColor: string | null): WorkspaceColor {
	if (!legacyColor) return "sky";
	const t = legacyColor.trim().toLowerCase();
	if (!t) return "sky";
	if (colorSet.has(t)) return t as WorkspaceColor;
	const hex = t.startsWith("#") ? t : namedColorHexMap[t];
	if (hex) return hexToColor(hex);
	return "sky";
}

function hexToColor(hex: string): WorkspaceColor {
	const c = hex.replace(/^#/, "");
	let r: number, g: number, b: number;
	if (c.length === 3) {
		r = parseInt(c[0]! + c[0]!, 16);
		g = parseInt(c[1]! + c[1]!, 16);
		b = parseInt(c[2]! + c[2]!, 16);
	} else if (c.length === 6) {
		r = parseInt(c.slice(0, 2), 16);
		g = parseInt(c.slice(2, 4), 16);
		b = parseInt(c.slice(4, 6), 16);
	} else {
		return "sky";
	}
	if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return "sky";
	const [h, s, l] = rgbToHsl(r, g, b);
	if (s < 10) return l >= 50 ? "sky-soft" : "sky-deep";
	let hue = "sky";
	for (const b of hueBuckets) {
		if (h >= b.minHue && h < b.maxHue) {
			hue = b.hue;
			break;
		}
	}
	const suffix = l >= 70 ? "-soft" : l >= 50 ? "" : l >= 35 ? "-bold" : "-deep";
	return `${hue}${suffix}` as WorkspaceColor;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
	const rn = r / 255,
		gn = g / 255,
		bn = b / 255;
	const max = Math.max(rn, gn, bn),
		min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, Math.round(l * 100)];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let hVal: number;
	if (max === rn) hVal = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
	else if (max === gn) hVal = ((bn - rn) / d + 2) / 6;
	else hVal = ((rn - gn) / d + 4) / 6;
	return [Math.round(hVal * 360), Math.round(s * 100), Math.round(l * 100)];
}

const heroiconsMap: Record<string, WorkspaceIcon> = {
	"academic-cap-icon": "graduation-cap",
	"academic-cap": "graduation-cap",
	"book-open-icon": "book-open",
	"document-text-icon": "file-text",
	"document-text": "file-text",
	"code-bracket-icon": "code-2",
	"code-bracket": "code-2",
	"chart-bar-icon": "chart-column",
	"chart-bar": "chart-column",
	"chart-pie-icon": "chart-pie",
	"computer-desktop-icon": "cpu",
	"computer-desktop": "cpu",
	"globe-americas-icon": "globe-2",
	"globe-americas": "globe-2",
	"globe-alt-icon": "globe-2",
	"globe-alt": "globe-2",
	"building-library-icon": "landmark",
	"building-library": "landmark",
	"beaker-icon": "flask-conical",
	beaker: "flask-conical",
	"megaphone-icon": "megaphone",
	"calculator-icon": "calculator",
	"bug-ant-icon": "atom",
	"bug-ant": "atom",
	"light-bulb-icon": "lightbulb",
	"light-bulb": "lightbulb",
	"pencil-icon": "notebook-pen",
	pencil: "notebook-pen",
	"folder-icon": "folder-open",
	"folder-open-icon": "folder-open",
	"document-icon": "file-text",
	"presentation-chart-bar-icon": "presentation",
	"presentation-chart-bar": "presentation",
	"musical-note-icon": "music",
	"musical-note": "music",
	"microphone-icon": "mic",
	microphone: "mic",
	"camera-icon": "camera",
	"video-camera-icon": "video",
	"video-camera": "video",
	"scale-icon": "scale",
	"users-icon": "users",
	"briefcase-icon": "briefcase-business",
	briefcase: "briefcase-business",
	"building-office-icon": "building-2",
	"building-office": "building-2",
	"newspaper-icon": "newspaper",
	"heart-icon": "heart-pulse",
	heart: "heart-pulse",
	"fire-icon": "flame",
	fire: "flame",
	"bolt-icon": "zap",
	bolt: "zap",
	"rocket-launch-icon": "rocket",
	"rocket-launch": "rocket",
	"star-icon": "target",
	star: "target",
	"map-icon": "map",
	"shield-check-icon": "shield-check",
	"shield-check": "shield-check",
	"wrench-icon": "wrench",
	"cog-icon": "wrench",
	cog: "wrench",
};

function normalizeLegacyIcon(legacyIcon: string | null): WorkspaceIcon {
	if (!legacyIcon) return "compass";
	const trimmed = legacyIcon.trim();
	if (!trimmed) return "compass";
	const stripped = trimmed.replace(/^lucide:/, "");
	const kebab = pascalToKebab(stripped);
	if (iconSet.has(kebab)) return kebab as WorkspaceIcon;
	if (heroiconsMap[kebab]) return heroiconsMap[kebab]!;
	return "compass";
}

function pascalToKebab(v: string): string {
	if (v.includes("-") || v.includes("_"))
		return v
			.replace(/_/g, "-")
			.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
			.toLowerCase();
	return v
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();
}

/* ------------------------------------------------------------------ */
/*  Item name normalization (mirrors defaults.ts)                      */
/* ------------------------------------------------------------------ */

function normalizeItemName(name: string | null | undefined, fallback = "Untitled"): string {
	const normalized =
		stripControlChars(name ?? "")
			.replace(/[\\/]+/g, "-")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 160)
			.trim() ?? "";
	return normalized || fallback;
}

function stripControlChars(value: string): string {
	return Array.from(value)
		.filter((c) => {
			const code = c.charCodeAt(0);
			return code >= 32 && code !== 127;
		})
		.join("");
}

function deduplicateSiblingNames(
	items: Array<{ name: string; parentId: string | null }>,
): Array<{ name: string; parentId: string | null; originalName: string; renamed: boolean }> {
	const seen = new Map<string, Set<string>>();
	return items.map((item) => {
		const parentKey = item.parentId ?? "__root__";
		let nameSet = seen.get(parentKey);
		if (!nameSet) {
			nameSet = new Set();
			seen.set(parentKey, nameSet);
		}
		const normalized = normalizeItemName(item.name);
		if (!nameSet.has(normalized)) {
			nameSet.add(normalized);
			return { name: normalized, parentId: item.parentId, originalName: item.name, renamed: false };
		}
		for (let suffix = 2; suffix < 10000; suffix++) {
			const candidate = normalizeItemName(`${normalized} ${suffix}`);
			if (!nameSet.has(candidate)) {
				nameSet.add(candidate);
				return { name: candidate, parentId: item.parentId, originalName: item.name, renamed: true };
			}
		}
		const fb = normalizeItemName(`${normalized} ${Date.now()}`);
		nameSet.add(fb);
		return { name: fb, parentId: item.parentId, originalName: item.name, renamed: true };
	});
}

/* ------------------------------------------------------------------ */
/*  Kept / dropped item types                                          */
/* ------------------------------------------------------------------ */

const KEPT_TYPES = new Set(["document", "pdf", "image", "folder"]);
const DROPPED_TYPES = new Set(["youtube", "audio", "flashcard", "quiz"]);

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
	console.log(`[migrate] Connecting to legacy database...`);
	const sql = postgres(LEGACY_DATABASE_URL);

	try {
		// 1. Find user
		const users = await sql<LegacyUser[]>`
			SELECT id, name, email, email_verified, image, created_at, updated_at
			FROM "user"
			WHERE ${userQuery.includes("@") ? sql`email = ${userQuery}` : sql`id = ${userQuery}`}
			LIMIT 1
		`;

		if (users.length === 0) {
			console.error(`[migrate] User not found: ${userQuery}`);
			process.exit(1);
		}

		const user = users[0]!;
		console.log(`[migrate] Found user: ${user.name} <${user.email}> (${user.id})`);

		// 2. Verify Google account
		const accounts = await sql<LegacyAccount[]>`
			SELECT id, account_id, provider_id, user_id, access_token, refresh_token, id_token, scope, created_at, updated_at
			FROM account
			WHERE user_id = ${user.id} AND provider_id = 'google'
			LIMIT 1
		`;

		if (accounts.length === 0) {
			console.error(
				`[migrate] No Google account found for user ${user.id}. Only Google users are migrated.`,
			);
			process.exit(1);
		}

		const account = accounts[0]!;
		console.log(`[migrate] Google account verified: ${account.account_id}`);

		// 3. Fetch workspaces owned by user
		const workspaces = await sql<LegacyWorkspace[]>`
			SELECT id, user_id, name, description, icon, color, last_opened_at, created_at, updated_at
			FROM workspaces
			WHERE user_id = ${user.id}
			ORDER BY created_at ASC
		`;

		console.log(`[migrate] Found ${workspaces.length} workspace(s) owned by user`);

		// 4. Build migration payload
		const migrationWorkspaces = [];

		for (const ws of workspaces) {
			const wsColor = normalizeLegacyColor(ws.color);
			const wsIcon = normalizeLegacyIcon(ws.icon);

			if (wsColor !== (ws.color ?? "sky")) {
				console.log(`[migrate]   workspace "${ws.name}": color "${ws.color}" → ${wsColor}`);
			}
			if (wsIcon !== (ws.icon ?? "compass")) {
				console.log(`[migrate]   workspace "${ws.name}": icon "${ws.icon}" → ${wsIcon}`);
			}

			// Fetch items
			const items = await sql<LegacyWorkspaceItem[]>`
				SELECT id, workspace_id, item_id, type, name, color, folder_id, sort_order
				FROM workspace_items
				WHERE workspace_id = ${ws.id}
				ORDER BY sort_order ASC NULLS LAST, created_at ASC
			`;

			// Build set of valid item IDs (folders + kept types)
			const keptItems: LegacyWorkspaceItem[] = [];
			const keptFolderIds = new Set<string>();

			for (const item of items) {
				if (KEPT_TYPES.has(item.type)) {
					keptItems.push(item);
					if (item.type === "folder") keptFolderIds.add(item.item_id);
				} else if (DROPPED_TYPES.has(item.type)) {
					console.log(`[migrate]   DROPPED: "${item.name}" (type: ${item.type})`);
				} else {
					console.log(`[migrate]   DROPPED: "${item.name}" (unknown type: ${item.type})`);
				}
			}

			// Reparent items with broken folder refs
			for (const item of keptItems) {
				if (item.folder_id && !keptFolderIds.has(item.folder_id)) {
					console.log(
						`[migrate]   REPARENTED: "${item.name}" from missing folder ${item.folder_id} → root`,
					);
					item.folder_id = null;
				}
			}

			// Deduplicate sibling names
			const dedupInput = keptItems.map((i) => ({
				name: i.name,
				parentId: i.folder_id,
			}));
			const dedupResult = deduplicateSiblingNames(dedupInput);

			for (let i = 0; i < dedupResult.length; i++) {
				const d = dedupResult[i]!;
				if (d.renamed) {
					console.log(`[migrate]   RENAMED: "${d.originalName}" → "${d.name}" (sibling collision)`);
				}
				keptItems[i]!.name = d.name;
			}

			// Fetch content + extracted for kept items
			const itemIds = keptItems.map((i) => i.item_id);
			let contentMap = new Map<string, LegacyItemContent>();
			let extractedMap = new Map<string, LegacyItemExtracted>();

			if (itemIds.length > 0) {
				const contents = await sql<LegacyItemContent[]>`
					SELECT item_id, text_content, structured_data, asset_data, embed_data, source_data
					FROM workspace_item_content
					WHERE item_id = ANY(${itemIds})
				`;
				for (const c of contents) contentMap.set(c.item_id, c);

				const extracted = await sql<LegacyItemExtracted[]>`
					SELECT item_id, ocr_pages, ocr_text
					FROM workspace_item_extracted
					WHERE item_id = ANY(${itemIds})
				`;
				for (const e of extracted) extractedMap.set(e.item_id, e);
			}

			// Transform items
			const migrationItems = [];

			for (const item of keptItems) {
				const content = contentMap.get(item.item_id);
				const extracted = extractedMap.get(item.item_id);

				if (item.type === "folder") {
					migrationItems.push({
						type: "folder" as const,
						id: item.item_id,
						name: item.name,
						parentId: item.folder_id,
						color: normalizeLegacyColor(item.color),
						sortOrder: item.sort_order ?? 0,
					});
				} else if (item.type === "document") {
					const md = resolveDocumentMarkdown(content);
					migrationItems.push({
						type: "document" as const,
						id: item.item_id,
						name: item.name,
						parentId: item.folder_id,
						sortOrder: item.sort_order ?? 0,
						content: md,
						metadataJson: content?.source_data ? { sources: content.source_data } : {},
					});
				} else if (item.type === "pdf" || item.type === "image") {
					const assetKind = item.type === "pdf" ? "pdf" : "image";
					const fileUrl = getFileUrl(content, item.type);

					if (!fileUrl) {
						console.log(`[migrate]   SKIPPED: "${item.name}" — no file URL found`);
						continue;
					}

					console.log(`[migrate]   Downloading ${assetKind}: "${item.name}"...`);
					const downloaded = await downloadSupabaseFile(fileUrl);

					if (!downloaded) {
						console.log(`[migrate]   SKIPPED: "${item.name}" — download failed`);
						continue;
					}

					migrationItems.push({
						type: "file" as const,
						id: item.item_id,
						name: item.name,
						parentId: item.folder_id,
						sortOrder: item.sort_order ?? 0,
						assetKind: assetKind as "pdf" | "image",
						fileName: extractFileName(fileUrl, item.name, assetKind),
						contentType: downloaded.contentType,
						sizeBytes: downloaded.bytes.length,
						bytesBase64: bufferToBase64(downloaded.bytes),
						ocrPages: extracted?.ocr_pages ?? null,
					});
				}
			}

			migrationWorkspaces.push({
				id: ws.id,
				name: ws.name,
				description: ws.description,
				icon: wsIcon,
				color: wsColor,
				lastOpenedAt: ws.last_opened_at?.toISOString() ?? null,
				createdAt: ws.created_at.toISOString(),
				updatedAt: ws.updated_at.toISOString(),
				items: migrationItems,
			});

			console.log(`[migrate] Workspace "${ws.name}": ${migrationItems.length} items ready`);
		}

		const payload = {
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				emailVerified: user.email_verified,
				image: user.image,
				createdAt: user.created_at.toISOString(),
				updatedAt: user.updated_at.toISOString(),
			},
			account: {
				id: account.id,
				accountId: account.account_id,
				providerId: "google" as const,
				userId: account.user_id,
				accessToken: account.access_token,
				refreshToken: account.refresh_token,
				idToken: account.id_token,
				scope: account.scope,
				createdAt: account.created_at.toISOString(),
				updatedAt: account.updated_at.toISOString(),
			},
			workspaces: migrationWorkspaces,
		};

		// 5. POST to importer endpoint
		const url = `${MIGRATION_IMPORT_URL}/api/admin/migration-import`;
		console.log(`[migrate] Posting payload to ${url}...`);

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-migration-secret": MIGRATION_IMPORT_SECRET,
			},
			body: JSON.stringify(payload),
		});

		const responseBody = await response.text();

		if (!response.ok) {
			console.error(`[migrate] Import failed (${response.status}): ${responseBody}`);
			process.exit(1);
		}

		console.log(`[migrate] Import response: ${responseBody}`);
		console.log(`[migrate] Done!`);
	} finally {
		await sql.end();
	}
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`[migrate] Missing required env var: ${name}`);
		process.exit(1);
	}
	return value;
}

function resolveDocumentMarkdown(content: LegacyItemContent | undefined): string {
	if (!content) return "";
	if (content.structured_data?.markdown && typeof content.structured_data.markdown === "string") {
		return content.structured_data.markdown;
	}
	return content.text_content ?? "";
}

function getFileUrl(content: LegacyItemContent | undefined, type: string): string | null {
	if (!content?.asset_data) return null;
	const ad = content.asset_data as Record<string, unknown>;
	if (type === "pdf" && typeof ad.fileUrl === "string") return ad.fileUrl;
	if (type === "image" && typeof ad.url === "string") return ad.url;
	if (typeof ad.fileUrl === "string") return ad.fileUrl;
	if (typeof ad.url === "string") return ad.url;
	return null;
}

function extractFileName(url: string, name: string, kind: string): string {
	try {
		const pathname = new URL(url).pathname;
		const lastSegment = pathname.split("/").pop();
		if (lastSegment && lastSegment.includes(".")) return decodeURIComponent(lastSegment);
	} catch {
		// fall through
	}
	const ext = kind === "pdf" ? ".pdf" : ".png";
	return `${name}${ext}`;
}

async function downloadSupabaseFile(
	fileUrl: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
	try {
		const url = new URL(fileUrl);

		// If it's a Supabase storage URL, use the service key
		if (url.hostname.includes("supabase")) {
			const storageUrl = `${LEGACY_SUPABASE_URL}/storage/v1/object${url.pathname.replace(/^\/storage\/v1\/object/, "")}`;
			const res = await fetch(storageUrl, {
				headers: { Authorization: `Bearer ${LEGACY_SUPABASE_SERVICE_KEY}` },
			});
			if (!res.ok) {
				console.error(`[migrate]   Download failed: ${res.status} ${res.statusText}`);
				return null;
			}
			const buf = await res.arrayBuffer();
			return {
				bytes: new Uint8Array(buf),
				contentType: res.headers.get("content-type") ?? "application/octet-stream",
			};
		}

		// Generic URL fetch
		const res = await fetch(fileUrl);
		if (!res.ok) return null;
		const buf = await res.arrayBuffer();
		return {
			bytes: new Uint8Array(buf),
			contentType: res.headers.get("content-type") ?? "application/octet-stream",
		};
	} catch (error) {
		console.error(`[migrate]   Download error:`, error);
		return null;
	}
}

function bufferToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]!);
	}
	return btoa(binary);
}

main().catch((error) => {
	console.error("[migrate] Fatal error:", error);
	process.exit(1);
});
