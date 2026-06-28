import { mkdir, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { resolve, join } from "node:path";

import { Pool } from "pg";

import { parseMarkdownToTiptapDocumentProjection } from "../src/features/workspaces/documents/document-markdown";
import { stringifyTiptapDocumentJson } from "../src/features/workspaces/documents/tiptap-document";

type LegacyJson = Record<string, unknown> | null;

type LegacyUserRow = {
	legacy_user_id: string;
	name: string | null;
	email: string;
	email_verified: boolean;
	image: string | null;
	user_created_at: Date | string;
	user_updated_at: Date | string;
	account_id: string;
	account_created_at: Date | string;
	account_updated_at: Date | string;
};

type LegacyWorkspaceRow = {
	id: string;
	user_id: string;
	name: string;
	description: string | null;
	icon: string | null;
	color: string | null;
	created_at: Date | string;
	updated_at: Date | string;
	last_opened_at: Date | string | null;
};

type LegacyCollaboratorRow = {
	workspace_id: string;
	user_id: string;
	permission_level: "editor" | "viewer";
	created_at: Date | string | null;
	last_opened_at: Date | string | null;
};

type LegacyItemRow = {
	item_id: string;
	type: string;
	name: string;
	color: string | null;
	folder_id: string | null;
	sort_order: number | null;
	created_at: Date | string | null;
	updated_at: Date | string | null;
	text_content: string | null;
	asset_data: LegacyJson;
	ocr_pages: unknown[] | null;
};

type ImportedUser = {
	accountId: string;
	email: string;
	legacyUserId: string;
	newUserId: string;
};

type ImportedWorkspace = {
	legacyWorkspaceId: string;
	newWorkspaceId: string;
	ownerUserId: string;
};

type ItemSkip = {
	itemId: string;
	name: string;
	reason: string;
	type: string;
	workspaceId: string;
};

type WorkspaceSkip = {
	legacyWorkspaceId: string;
	ownerLegacyUserId: string;
	reason: string;
};

type MigrationStats = {
	documentsConverted: number;
	fileDownloadsAttempted: number;
	fileDownloadsSucceeded: number;
	isDryRun: boolean;
	membersImported: number;
	skippedWorkspaces: number;
	usersImported: number;
	workspacesImported: number;
};

interface MigrationTargetClient {
	command(command: unknown): Promise<unknown>;
	importFile(
		metadata: Record<string, unknown>,
		bytes: Uint8Array,
		fileName: string,
	): Promise<unknown>;
}

const supportedFileTypes = new Set(["pdf", "image"]);
const supportedItemTypes = new Set(["folder", "document", "pdf", "image"]);
const migrationAuthHeader = "x-thinkex-migration-token";
const userProgressLogEvery = 25;
const workspaceProgressLogEvery = 25;
const memberProgressLogEvery = 100;
const itemProgressLogEvery = 100;
const fileProgressLogEvery = 100;
const workspaceConcurrency = Number.parseInt(
	process.env.THINKEX_MIGRATION_WORKSPACE_CONCURRENCY ?? "4",
	10,
);
const userConcurrency = Number.parseInt(process.env.THINKEX_MIGRATION_USER_CONCURRENCY ?? "16", 10);
const memberConcurrency = Number.parseInt(
	process.env.THINKEX_MIGRATION_MEMBER_CONCURRENCY ?? "24",
	10,
);
const outputDir = resolve(
	process.env.THINKEX_MIGRATION_OUTPUT_DIR ??
		join(process.cwd(), ".migration-artifacts", `thinkex-${Date.now()}`),
);
const isDryRun = process.env.THINKEX_MIGRATION_DRY_RUN === "1";
const stats: MigrationStats = {
	documentsConverted: 0,
	fileDownloadsAttempted: 0,
	fileDownloadsSucceeded: 0,
	isDryRun,
	membersImported: 0,
	skippedWorkspaces: 0,
	usersImported: 0,
	workspacesImported: 0,
};
const targetApi: MigrationTargetClient = isDryRun
	? createDryRunTargetClient()
	: createMigrationTargetClient({
			baseUrl: requireEnv("NEW_THINKEX_BASE_URL"),
			token: requireEnv("THINKEX_MIGRATION_ADMIN_TOKEN"),
		});

const legacySupabaseOrigin = getOptionalHttpOriginEnv("THINKEX_LEGACY_SUPABASE_URL");
const legacySupabaseServiceRoleKey = getOptionalEnv("THINKEX_LEGACY_SUPABASE_SERVICE_ROLE_KEY");

async function main() {
	await mkdir(outputDir, { recursive: true });
	logInfo("Starting ThinkEx bulk migration", {
		isDryRun,
		memberConcurrency,
		outputDir,
		userConcurrency,
		workspaceConcurrency,
	});

	const pool = new Pool({
		connectionString: requireAnyEnv("THINKEX_LEGACY_DATABASE_URL", "DATABASE_URL"),
	});

	try {
		logInfo("Importing users");
		const importedUsers = await importUsers(pool);
		const userMap = new Map(importedUsers.map((user) => [user.legacyUserId, user]));
		logInfo("Importing workspaces");
		const { importedWorkspaces, skippedWorkspaces } = await importWorkspaces(pool, userMap);
		const workspaceMap = new Map(
			importedWorkspaces.map((workspace) => [workspace.legacyWorkspaceId, workspace]),
		);

		logInfo("Importing workspace members");
		await importWorkspaceMembers(pool, userMap, workspaceMap);
		logInfo("Importing workspace items");
		const skippedItems = await importWorkspaceItems(pool, workspaceMap);

		await writeFile(
			join(outputDir, "summary.json"),
			JSON.stringify(
				{
					isDryRun,
					documentsConverted: stats.documentsConverted,
					fileDownloadsAttempted: stats.fileDownloadsAttempted,
					fileDownloadsSucceeded: stats.fileDownloadsSucceeded,
					membersImported: stats.membersImported,
					skippedWorkspaces: skippedWorkspaces.length,
					usersImported: importedUsers.length,
					workspacesImported: importedWorkspaces.length,
					skippedItems: skippedItems.length,
				},
				null,
				2,
			),
		);
		await writeFile(join(outputDir, "skipped-items.json"), JSON.stringify(skippedItems, null, 2));
		await writeFile(
			join(outputDir, "skipped-workspaces.json"),
			JSON.stringify(skippedWorkspaces, null, 2),
		);
		logInfo("Migration run finished", {
			documentsConverted: stats.documentsConverted,
			fileDownloadsAttempted: stats.fileDownloadsAttempted,
			fileDownloadsSucceeded: stats.fileDownloadsSucceeded,
			membersImported: stats.membersImported,
			skippedItems: skippedItems.length,
			skippedWorkspaces: skippedWorkspaces.length,
			usersImported: importedUsers.length,
			workspacesImported: importedWorkspaces.length,
		});
	} finally {
		await pool.end();
	}
}

async function importUsers(pool: Pool) {
	const result = await pool.query<LegacyUserRow>(`
		SELECT
			u.id AS legacy_user_id,
			u.name,
			u.email,
			u.email_verified,
			u.image,
			u.created_at AS user_created_at,
			u.updated_at AS user_updated_at,
			a.account_id,
			a.created_at AS account_created_at,
			a.updated_at AS account_updated_at
		FROM "user" u
		INNER JOIN account a
			ON a.user_id = u.id
			AND a.provider_id = 'google'
		ORDER BY u.created_at ASC, u.id ASC
		`);
	logInfo("Loaded legacy Google-linked users", { total: result.rows.length });

	const importedUsers: ImportedUser[] = [];

	await runWithConcurrency(result.rows, userConcurrency, async (row) => {
		const newUserId = randomUUID();
		await targetApi.command({
			type: "import_user",
			input: {
				userId: newUserId,
				accountId: row.account_id,
				name: resolveLegacyUserName(row),
				email: row.email,
				emailVerified: row.email_verified,
				image: row.image,
				createdAt: toIsoString(row.user_created_at),
				updatedAt: toIsoString(row.user_updated_at),
				accountCreatedAt: toIsoString(row.account_created_at),
				accountUpdatedAt: toIsoString(row.account_updated_at),
			},
		});

		importedUsers.push({
			accountId: row.account_id,
			email: row.email,
			legacyUserId: row.legacy_user_id,
			newUserId,
		});
		stats.usersImported += 1;
		if (
			stats.usersImported % userProgressLogEvery === 0 ||
			stats.usersImported === result.rows.length
		) {
			logInfo("User import progress", { imported: stats.usersImported, total: result.rows.length });
		}
	});

	return importedUsers;
}

async function importWorkspaces(pool: Pool, userMap: Map<string, ImportedUser>) {
	const result = await pool.query<LegacyWorkspaceRow>(`
		SELECT id, user_id, name, description, icon, color, created_at, updated_at, last_opened_at
		FROM workspaces
		ORDER BY created_at ASC, id ASC
		`);
	logInfo("Loaded legacy workspaces", { total: result.rows.length });

	const imported: ImportedWorkspace[] = [];
	const skippedWorkspaces: WorkspaceSkip[] = [];
	let processed = 0;

	await runWithConcurrency(result.rows, workspaceConcurrency, async (row) => {
		const owner = userMap.get(row.user_id);
		if (!owner) {
			skippedWorkspaces.push({
				legacyWorkspaceId: row.id,
				ownerLegacyUserId: row.user_id,
				reason: "owner_not_google_linked",
			});
			stats.skippedWorkspaces += 1;
			processed += 1;
			if (processed % workspaceProgressLogEvery === 0 || processed === result.rows.length) {
				logInfo("Workspace import progress", {
					imported: imported.length,
					processed,
					skipped: skippedWorkspaces.length,
					total: result.rows.length,
				});
			}
			return;
		}

		const newWorkspaceId = randomUUID();
		await targetApi.command({
			type: "import_workspace",
			input: {
				workspaceId: newWorkspaceId,
				legacyWorkspaceId: row.id,
				ownerUserId: owner.newUserId,
				name: row.name,
				description: row.description,
				icon: row.icon,
				color: row.color,
				createdAt: toIsoString(row.created_at),
				updatedAt: toIsoString(row.updated_at),
				lastOpenedAt: toNullableIsoString(row.last_opened_at),
			},
		});

		imported.push({
			legacyWorkspaceId: row.id,
			newWorkspaceId,
			ownerUserId: owner.newUserId,
		});
		stats.workspacesImported += 1;
		processed += 1;
		if (processed % workspaceProgressLogEvery === 0 || processed === result.rows.length) {
			logInfo("Workspace import progress", {
				imported: imported.length,
				processed,
				skipped: skippedWorkspaces.length,
				total: result.rows.length,
			});
		}
	});

	return { importedWorkspaces: imported, skippedWorkspaces };
}

async function importWorkspaceMembers(
	pool: Pool,
	userMap: Map<string, ImportedUser>,
	workspaceMap: Map<string, ImportedWorkspace>,
) {
	const workspaceIds = [...workspaceMap.keys()];
	if (workspaceIds.length === 0) {
		return;
	}

	const result = await pool.query<LegacyCollaboratorRow>(
		`
			SELECT workspace_id, user_id, permission_level, created_at, last_opened_at
			FROM workspace_collaborators
			WHERE workspace_id = ANY($1::uuid[])
			ORDER BY created_at ASC NULLS LAST, workspace_id ASC, user_id ASC
		`,
		[workspaceIds],
	);
	logInfo("Loaded legacy collaborator memberships", { total: result.rows.length });
	let processed = 0;

	await runWithConcurrency(result.rows, memberConcurrency, async (row) => {
		const workspace = workspaceMap.get(row.workspace_id);
		const user = userMap.get(row.user_id);

		if (!workspace || !user) {
			return;
		}

		await targetApi.command({
			type: "import_workspace_member",
			input: {
				workspaceId: workspace.newWorkspaceId,
				userId: user.newUserId,
				role: row.permission_level,
				createdAt: toIsoString(row.created_at ?? row.last_opened_at ?? new Date()),
				lastOpenedAt: toNullableIsoString(row.last_opened_at),
			},
		});
		stats.membersImported += 1;
		processed += 1;
		if (processed % memberProgressLogEvery === 0 || processed === result.rows.length) {
			logInfo("Workspace member import progress", {
				imported: stats.membersImported,
				processed,
				total: result.rows.length,
			});
		}
	});
}

async function importWorkspaceItems(pool: Pool, workspaceMap: Map<string, ImportedWorkspace>) {
	const skippedItems: ItemSkip[] = [];

	await runWithConcurrency([...workspaceMap.values()], workspaceConcurrency, async (workspace) => {
		logInfo("Importing workspace items", {
			legacyWorkspaceId: workspace.legacyWorkspaceId,
			newWorkspaceId: workspace.newWorkspaceId,
		});
		const result = await pool.query<LegacyItemRow>(
			`
				SELECT
					i.item_id,
					i.type,
					i.name,
					i.color,
					i.folder_id,
					i.sort_order,
					i.created_at,
					i.updated_at,
					c.text_content,
					c.asset_data,
					e.ocr_pages
				FROM workspace_items i
				LEFT JOIN workspace_item_content c
					ON c.workspace_id = i.workspace_id
					AND c.item_id = i.item_id
				LEFT JOIN workspace_item_extracted e
					ON e.workspace_id = i.workspace_id
					AND e.item_id = i.item_id
				WHERE i.workspace_id = $1
				ORDER BY COALESCE(i.sort_order, 2147483647) ASC, i.created_at ASC NULLS LAST, i.item_id ASC
			`,
			[workspace.legacyWorkspaceId],
		);
		logInfo("Loaded workspace items", {
			legacyWorkspaceId: workspace.legacyWorkspaceId,
			total: result.rows.length,
		});

		const mapping = new Map<string, string>();
		const importedLegacyItemIds = new Set<string>();
		let processedItems = 0;

		for (const row of result.rows) {
			if (supportedItemTypes.has(row.type)) {
				mapping.set(row.item_id, randomUUID());
			}
		}

		const folderRows = sortFoldersFirst(result.rows.filter((row) => row.type === "folder"));

		for (const row of folderRows) {
			if (
				!(await hasImportedParent(
					row,
					importedLegacyItemIds,
					skippedItems,
					workspace.newWorkspaceId,
				))
			) {
				continue;
			}

			await targetApi
				.command({
					type: "import_folder_item",
					input: {
						workspaceId: workspace.newWorkspaceId,
						itemId: getMappedId(mapping, row.item_id),
						parentId: row.folder_id ? getMappedId(mapping, row.folder_id) : null,
						name: row.name,
						color: row.color,
						sortOrder: row.sort_order ?? 0,
						createdAt: toIsoString(row.created_at ?? new Date()),
						updatedAt: toIsoString(row.updated_at ?? row.created_at ?? new Date()),
					},
				})
				.then(() => {
					importedLegacyItemIds.add(row.item_id);
					processedItems += 1;
					logWorkspaceItemProgress(workspace.legacyWorkspaceId, processedItems, result.rows.length);
				})
				.catch((error) => {
					skippedItems.push(createSkip(row, workspace.newWorkspaceId, getErrorMessage(error)));
					processedItems += 1;
					logWorkspaceItemProgress(workspace.legacyWorkspaceId, processedItems, result.rows.length);
				});
		}

		for (const row of result.rows.filter((entry) => entry.type !== "folder")) {
			if (!supportedItemTypes.has(row.type)) {
				skippedItems.push(createSkip(row, workspace.newWorkspaceId, "unsupported_item_type"));
				processedItems += 1;
				logWorkspaceItemProgress(workspace.legacyWorkspaceId, processedItems, result.rows.length);
				continue;
			}

			if (
				!(await hasImportedParent(
					row,
					importedLegacyItemIds,
					skippedItems,
					workspace.newWorkspaceId,
				))
			) {
				processedItems += 1;
				logWorkspaceItemProgress(workspace.legacyWorkspaceId, processedItems, result.rows.length);
				continue;
			}

			try {
				if (row.type === "document") {
					const content = stringifyTiptapDocumentJson(
						parseMarkdownToTiptapDocumentProjection(row.text_content ?? "").document,
					);
					await targetApi.command({
						type: "import_document_item",
						input: {
							workspaceId: workspace.newWorkspaceId,
							itemId: getMappedId(mapping, row.item_id),
							parentId: row.folder_id ? getMappedId(mapping, row.folder_id) : null,
							name: row.name,
							color: row.color,
							sortOrder: row.sort_order ?? 0,
							createdAt: toIsoString(row.created_at ?? new Date()),
							updatedAt: toIsoString(row.updated_at ?? row.created_at ?? new Date()),
							content,
						},
					});
					stats.documentsConverted += 1;
					importedLegacyItemIds.add(row.item_id);
					processedItems += 1;
					logWorkspaceItemProgress(workspace.legacyWorkspaceId, processedItems, result.rows.length);
					continue;
				}

				if (supportedFileTypes.has(row.type)) {
					const assetData = row.asset_data ?? {};
					const fileUrl = getLegacyFileUrl(row.type, assetData);

					if (!fileUrl) {
						skippedItems.push(createSkip(row, workspace.newWorkspaceId, "missing_file_url"));
						processedItems += 1;
						logWorkspaceItemProgress(
							workspace.legacyWorkspaceId,
							processedItems,
							result.rows.length,
						);
						continue;
					}

					stats.fileDownloadsAttempted += 1;
					const download = await downloadLegacyFile(fileUrl);
					stats.fileDownloadsSucceeded += 1;
					if (
						stats.fileDownloadsAttempted % fileProgressLogEvery === 0 ||
						stats.fileDownloadsAttempted === stats.fileDownloadsSucceeded
					) {
						logInfo("File download progress", {
							attempted: stats.fileDownloadsAttempted,
							succeeded: stats.fileDownloadsSucceeded,
						});
					}
					const originalName = resolveLegacyOriginalName(row, assetData, download.contentType);
					await targetApi.importFile(
						{
							workspaceId: workspace.newWorkspaceId,
							itemId: getMappedId(mapping, row.item_id),
							parentId: row.folder_id ? getMappedId(mapping, row.folder_id) : null,
							name: row.name,
							assetKind: row.type,
							contentType: download.contentType,
							sizeBytes: download.bytes.byteLength,
							originalName,
							sortOrder: row.sort_order ?? 0,
							createdAt: toIsoString(row.created_at ?? new Date()),
							updatedAt: toIsoString(row.updated_at ?? row.created_at ?? new Date()),
							ocrPages:
								Array.isArray(row.ocr_pages) && row.ocr_pages.length > 0
									? JSON.stringify(row.ocr_pages)
									: null,
							ocrSourceHash: hashBytesBase64Url(download.bytes),
						},
						download.bytes,
						originalName,
					);
					importedLegacyItemIds.add(row.item_id);
					processedItems += 1;
					logWorkspaceItemProgress(workspace.legacyWorkspaceId, processedItems, result.rows.length);
				}
			} catch (error) {
				skippedItems.push(createSkip(row, workspace.newWorkspaceId, getErrorMessage(error)));
				processedItems += 1;
				logWorkspaceItemProgress(workspace.legacyWorkspaceId, processedItems, result.rows.length);
			}
		}
		logInfo("Finished workspace items", {
			legacyWorkspaceId: workspace.legacyWorkspaceId,
			processedItems,
			total: result.rows.length,
		});
	});

	return skippedItems;
}

async function hasImportedParent(
	row: Pick<LegacyItemRow, "folder_id" | "item_id" | "name" | "type">,
	importedLegacyItemIds: Set<string>,
	skippedItems: ItemSkip[],
	workspaceId: string,
) {
	if (!row.folder_id) {
		return true;
	}

	if (importedLegacyItemIds.has(row.folder_id)) {
		return true;
	}

	skippedItems.push(
		createSkip({ ...row, item_id: row.item_id }, workspaceId, "missing_or_skipped_parent"),
	);
	return false;
}

function sortFoldersFirst(rows: LegacyItemRow[]) {
	const byId = new Map(rows.map((row) => [row.item_id, row]));

	return [...rows].sort((left, right) => {
		const depthDifference = getFolderDepth(left, byId) - getFolderDepth(right, byId);
		if (depthDifference !== 0) {
			return depthDifference;
		}

		return (left.sort_order ?? 0) - (right.sort_order ?? 0) || left.name.localeCompare(right.name);
	});
}

function getFolderDepth(row: LegacyItemRow, byId: Map<string, LegacyItemRow>) {
	let depth = 0;
	let currentParentId = row.folder_id;

	while (currentParentId) {
		const parent = byId.get(currentParentId);
		if (!parent) {
			break;
		}

		depth += 1;
		currentParentId = parent.folder_id;
	}

	return depth;
}

function getMappedId(mapping: Map<string, string>, legacyId: string) {
	const mapped = mapping.get(legacyId);
	if (!mapped) {
		throw new Error(`Missing migrated item mapping for ${legacyId}`);
	}

	return mapped;
}

function resolveLegacyUserName(row: LegacyUserRow) {
	const trimmedName = row.name?.trim();
	if (trimmedName) {
		return trimmedName;
	}

	return row.email.split("@")[0] || `user-${row.legacy_user_id.slice(0, 8)}`;
}

function toIsoString(value: Date | string) {
	return new Date(value).toISOString();
}

function toNullableIsoString(value: Date | string | null) {
	return value ? new Date(value).toISOString() : null;
}

function getLegacyFileUrl(type: string, assetData: LegacyJson) {
	if (type === "pdf") {
		return getRecordString(assetData, "fileUrl");
	}

	if (type === "image") {
		return getRecordString(assetData, "url");
	}

	return null;
}

function resolveLegacyOriginalName(row: LegacyItemRow, assetData: LegacyJson, contentType: string) {
	const explicitName = getRecordString(assetData, "filename");
	if (explicitName) {
		return explicitName;
	}

	const fileUrl = getLegacyFileUrl(row.type, assetData);
	if (fileUrl) {
		const fromPath = decodeURIComponent(new URL(fileUrl).pathname.split("/").pop() || "");
		if (fromPath) {
			return fromPath;
		}
	}

	const extension = contentType.startsWith("image/") ? contentType.split("/")[1] || "bin" : "pdf";
	return `${row.name}.${extension}`;
}

async function downloadLegacyFile(fileUrl: string) {
	const directResponse = await fetch(fileUrl);
	if (directResponse.ok) {
		return {
			bytes: new Uint8Array(await directResponse.arrayBuffer()),
			contentType: directResponse.headers.get("content-type") || inferContentType(fileUrl),
		};
	}

	const objectPath = extractSupabaseObjectPath(fileUrl);
	if (!objectPath) {
		throw new Error(`legacy_file_download_failed:${directResponse.status}`);
	}

	const authenticatedUrl = buildLegacySupabaseObjectUrl(fileUrl, objectPath);
	const response = await fetch(authenticatedUrl, {
		headers: legacySupabaseServiceRoleKey
			? {
					authorization: `Bearer ${legacySupabaseServiceRoleKey}`,
					apikey: legacySupabaseServiceRoleKey,
				}
			: undefined,
	});

	if (!response.ok) {
		throw new Error(
			`legacy_file_download_failed:${directResponse.status}:${response.status}:${authenticatedUrl}`,
		);
	}

	return {
		bytes: new Uint8Array(await response.arrayBuffer()),
		contentType: response.headers.get("content-type") || inferContentType(fileUrl),
	};
}

function extractSupabaseObjectPath(fileUrl: string) {
	try {
		const pathname = new URL(fileUrl).pathname;
		const marker = "/storage/v1/object/public/file-upload/";
		const index = pathname.indexOf(marker);

		if (index === -1) {
			return null;
		}

		return pathname.slice(index + marker.length);
	} catch {
		return null;
	}
}

function buildLegacySupabaseObjectUrl(fileUrl: string, objectPath: string) {
	const origin = legacySupabaseOrigin ?? new URL(fileUrl).origin;
	return `${origin}/storage/v1/object/file-upload/${objectPath}`;
}

function inferContentType(fileUrl: string) {
	const lower = fileUrl.toLowerCase();
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
	if (lower.endsWith(".webp")) return "image/webp";
	if (lower.endsWith(".gif")) return "image/gif";
	return "application/pdf";
}

function hashBytesBase64Url(bytes: Uint8Array) {
	return createHash("sha256").update(bytes).digest("base64url");
}

function getRecordString(record: LegacyJson, key: string) {
	const value = record?.[key];
	return typeof value === "string" ? value : null;
}

function createSkip(
	row: Pick<LegacyItemRow, "item_id" | "name" | "type">,
	workspaceId: string,
	reason: string,
) {
	return {
		itemId: row.item_id,
		name: row.name,
		type: row.type,
		workspaceId,
		reason,
	} satisfies ItemSkip;
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function requireEnv(name: string) {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}

	return value;
}

function requireAnyEnv(...names: string[]) {
	for (const name of names) {
		const value = process.env[name]?.trim();
		if (value) {
			return value;
		}
	}

	throw new Error(`Missing required env var: ${names.join(" or ")}`);
}

function getOptionalEnv(name: string) {
	const value = process.env[name]?.trim();
	return value ? value : null;
}

function getOptionalHttpOriginEnv(name: string) {
	const value = getOptionalEnv(name);
	if (!value) {
		return null;
	}

	try {
		const url = new URL(value);
		if (!/^https?:$/.test(url.protocol)) {
			return null;
		}

		if (url.username || url.password) {
			return null;
		}

		return url.origin;
	} catch {
		return null;
	}
}

async function runWithConcurrency<T>(
	values: readonly T[],
	limit: number,
	worker: (value: T, index: number) => Promise<void>,
) {
	const concurrency = Math.max(1, limit);
	let nextIndex = 0;

	await Promise.all(
		Array.from({ length: Math.min(concurrency, values.length) }, async () => {
			while (nextIndex < values.length) {
				const currentIndex = nextIndex;
				nextIndex += 1;
				await worker(values[currentIndex], currentIndex);
			}
		}),
	);
}

function createMigrationTargetClient(input: { baseUrl: string; token: string }) {
	const headers = {
		[migrationAuthHeader]: input.token,
	};

	return {
		async command(command: unknown) {
			const response = await fetch(
				`${input.baseUrl.replace(/\/$/, "")}/api/v1/admin/thinkex-migration`,
				{
					method: "POST",
					headers: {
						...headers,
						"content-type": "application/json",
					},
					body: JSON.stringify({ command }),
				},
			);

			if (!response.ok) {
				throw new Error(`target_command_failed:${response.status}:${await response.text()}`);
			}

			return await response.json();
		},
		async importFile(metadata: Record<string, unknown>, bytes: Uint8Array, fileName: string) {
			const formData = new FormData();
			formData.set("metadata", JSON.stringify(metadata));
			formData.set("file", new File([Uint8Array.from(bytes) as unknown as BlobPart], fileName));

			const response = await fetch(
				`${input.baseUrl.replace(/\/$/, "")}/api/v1/admin/thinkex-migration/file`,
				{
					method: "POST",
					headers,
					body: formData,
				},
			);

			if (!response.ok) {
				throw new Error(`target_file_import_failed:${response.status}:${await response.text()}`);
			}

			return await response.json();
		},
	};
}

function createDryRunTargetClient() {
	return {
		async command() {
			return { ok: true };
		},
		async importFile() {
			return { ok: true };
		},
	};
}

function logWorkspaceItemProgress(
	legacyWorkspaceId: string,
	processedItems: number,
	totalItems: number,
) {
	if (processedItems % itemProgressLogEvery === 0 || processedItems === totalItems) {
		logInfo("Workspace item import progress", {
			legacyWorkspaceId,
			processedItems,
			totalItems,
		});
	}
}

function logInfo(message: string, details?: Record<string, unknown>) {
	const timestamp = new Date().toISOString();
	console.log(
		JSON.stringify({
			details: details ?? {},
			level: "info",
			message,
			timestamp,
		}),
	);
}

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
