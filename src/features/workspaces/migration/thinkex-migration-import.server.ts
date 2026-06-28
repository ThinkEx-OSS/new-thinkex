import { createDbContext } from "#/db/server";
import { account, user, workspaceMembers, workspaces } from "#/db/schema";
import { eq } from "drizzle-orm";
import {
	convertLegacyOcrPagesToMarkdownPages,
	parseLegacyOcrPagesProjectionContent,
} from "#/features/workspaces/extraction/legacy-ocr-pages";
import { serializeMarkdownPagesProjection } from "#/features/workspaces/extraction/page-markdown-projection";
import { getWorkspaceKernel } from "#/features/workspaces/kernel/workspace-kernel-access";
import {
	normalizeThinkexLegacyWorkspaceColor,
	normalizeThinkexLegacyWorkspaceIcon,
} from "#/features/workspaces/migration/thinkex-legacy-visuals";
import { mapWorkspaceRow } from "#/features/workspaces/server/mappers";
import type {
	ThinkexMigrationBackfillVisualsInput,
	ThinkexMigrationBackfillVisualsResult,
	ThinkexMigrationImportDocumentItemInput,
	ThinkexMigrationImportFileItemInput,
	ThinkexMigrationImportFolderItemInput,
	ThinkexMigrationImportUserInput,
	ThinkexMigrationImportWorkspaceInput,
	ThinkexMigrationImportWorkspaceMemberInput,
	ThinkexMigrationImportWorkspaceResult,
	ThinkexMigrationImportedFileProjectionMetadata,
	ThinkexMigrationListBackfillWorkspacesInput,
	ThinkexMigrationListBackfillWorkspacesResult,
} from "#/features/workspaces/migration/thinkex-migration-types";

const legacyProjectionProvider = "thinkex_migration";
const legacyProjectionProviderMode = "legacy_import";

export async function importThinkexUser(input: ThinkexMigrationImportUserInput) {
	const dbContext = await createDbContext();

	try {
		await dbContext.db.insert(user).values({
			id: input.userId,
			name: input.name,
			email: input.email,
			emailVerified: input.emailVerified,
			image: input.image ?? null,
			createdAt: parseTimestamp(input.createdAt),
			updatedAt: parseTimestamp(input.updatedAt),
		});

		await dbContext.db.insert(account).values({
			id: crypto.randomUUID(),
			accountId: input.accountId,
			providerId: "google",
			userId: input.userId,
			createdAt: parseTimestamp(input.accountCreatedAt),
			updatedAt: parseTimestamp(input.accountUpdatedAt),
		});
	} finally {
		await dbContext.dispose();
	}
}

export async function importThinkexWorkspace(
	input: ThinkexMigrationImportWorkspaceInput,
): Promise<ThinkexMigrationImportWorkspaceResult> {
	const dbContext = await createDbContext();

	try {
		const createdAt = parseTimestamp(input.createdAt);
		const updatedAt = parseTimestamp(input.updatedAt);
		const lastOpenedAt = parseNullableTimestamp(input.lastOpenedAt);

		await dbContext.db.batch([
			dbContext.db.insert(workspaces).values({
				id: input.workspaceId,
				name: input.name,
				description: input.description ?? null,
				icon: input.icon ?? null,
				color: input.color ?? null,
				ownerId: input.ownerUserId,
				createdAt,
				updatedAt,
				archivedAt: null,
			}),
			dbContext.db.insert(workspaceMembers).values({
				id: crypto.randomUUID(),
				workspaceId: input.workspaceId,
				userId: input.ownerUserId,
				role: "owner",
				lastOpenedAt,
				createdAt,
				updatedAt,
			}),
		]);

		return {
			workspace: mapWorkspaceRow(
				{
					id: input.workspaceId,
					name: input.name,
					description: input.description ?? null,
					icon: input.icon ?? null,
					color: input.color ?? null,
					ownerId: input.ownerUserId,
					createdAt,
					updatedAt,
					archivedAt: null,
					lastOpenedAt,
				},
				"owner",
			),
		};
	} finally {
		await dbContext.dispose();
	}
}

export async function importThinkexWorkspaceMember(
	input: ThinkexMigrationImportWorkspaceMemberInput,
) {
	const dbContext = await createDbContext();

	try {
		const createdAt = parseTimestamp(input.createdAt);
		await dbContext.db.insert(workspaceMembers).values({
			id: crypto.randomUUID(),
			workspaceId: input.workspaceId,
			userId: input.userId,
			role: input.role,
			lastOpenedAt: parseNullableTimestamp(input.lastOpenedAt),
			createdAt,
			updatedAt: createdAt,
		});
	} finally {
		await dbContext.dispose();
	}
}

export async function importThinkexDocumentItem(input: ThinkexMigrationImportDocumentItemInput) {
	const kernel = await getWorkspaceKernel(input.workspaceId);

	return await kernel.importItem({
		id: input.itemId,
		parentId: input.parentId ?? null,
		type: "document",
		name: input.name,
		color: input.color ?? null,
		sortOrder: input.sortOrder,
		createdAt: parseTimestamp(input.createdAt).getTime(),
		updatedAt: parseTimestamp(input.updatedAt).getTime(),
		content: input.content,
	});
}

export async function importThinkexFolderItem(input: ThinkexMigrationImportFolderItemInput) {
	const kernel = await getWorkspaceKernel(input.workspaceId);

	return await kernel.importItem({
		id: input.itemId,
		parentId: input.parentId ?? null,
		type: "folder",
		name: input.name,
		color: input.color ?? null,
		sortOrder: input.sortOrder,
		createdAt: parseTimestamp(input.createdAt).getTime(),
		updatedAt: parseTimestamp(input.updatedAt).getTime(),
	});
}

export async function importThinkexFileItem(
	input: ThinkexMigrationImportFileItemInput & { bytes: Uint8Array },
) {
	const kernel = await getWorkspaceKernel(input.workspaceId);
	const createdAt = parseTimestamp(input.createdAt).getTime();
	const updatedAt = parseTimestamp(input.updatedAt).getTime();

	const item = await kernel.importFile({
		id: input.itemId,
		parentId: input.parentId ?? null,
		name: input.name,
		assetKind: input.assetKind,
		contentType: input.contentType,
		sizeBytes: input.sizeBytes,
		originalName: input.originalName,
		bytes: input.bytes,
		sortOrder: input.sortOrder,
		createdAt,
		updatedAt,
	});

	if (!input.ocrPages?.trim()) {
		return item;
	}

	const ocrPages = parseLegacyOcrPagesProjectionContent(input.ocrPages);
	const pages = convertLegacyOcrPagesToMarkdownPages(ocrPages);
	const metadataJson: ThinkexMigrationImportedFileProjectionMetadata = {
		legacyFormat: "thinkex_ocr_pages_v1",
		pageCount: pages.length,
	};

	await kernel.importFileProjection({
		itemId: input.itemId,
		format: "pages",
		status: "ready",
		content: serializeMarkdownPagesProjection(pages),
		sourceHash: input.ocrSourceHash ?? null,
		provider: legacyProjectionProvider,
		providerMode: legacyProjectionProviderMode,
		metadataJson,
		createdAt,
		updatedAt,
	});

	return item;
}

export async function listThinkexMigrationBackfillWorkspaces(
	input: ThinkexMigrationListBackfillWorkspacesInput = {},
): Promise<ThinkexMigrationListBackfillWorkspacesResult> {
	const dbContext = await createDbContext();
	const limit = Math.min(Math.max(input.limit ?? 1000, 1), 1000);
	const offset = Math.max(input.offset ?? 0, 0);

	try {
		const rows = await dbContext.db.select({ id: workspaces.id }).from(workspaces);

		return {
			total: rows.length,
			workspaceIds: rows.slice(offset, offset + limit).map((row) => row.id),
		};
	} finally {
		await dbContext.dispose();
	}
}

export async function backfillThinkexMigrationVisuals(
	input: ThinkexMigrationBackfillVisualsInput,
): Promise<ThinkexMigrationBackfillVisualsResult> {
	const dbContext = await createDbContext();

	try {
		const [workspace] = await dbContext.db
			.select({
				color: workspaces.color,
				icon: workspaces.icon,
				id: workspaces.id,
			})
			.from(workspaces)
			.where(eq(workspaces.id, input.workspaceId))
			.limit(1);

		if (!workspace) {
			throw new Error(`Workspace not found: ${input.workspaceId}`);
		}

		const normalizedColor = normalizeThinkexLegacyWorkspaceColor(workspace.color);
		const normalizedIcon = normalizeThinkexLegacyWorkspaceIcon(workspace.icon);
		const shouldUpdateColor = Boolean(normalizedColor && normalizedColor !== workspace.color);
		const shouldUpdateIcon = Boolean(normalizedIcon && normalizedIcon !== workspace.icon);

		if (!input.dryRun && (shouldUpdateColor || shouldUpdateIcon)) {
			await dbContext.db
				.update(workspaces)
				.set({
					color: shouldUpdateColor ? normalizedColor : workspace.color,
					icon: shouldUpdateIcon ? normalizedIcon : workspace.icon,
				})
				.where(eq(workspaces.id, input.workspaceId));
		}

		const kernel = await getWorkspaceKernel(input.workspaceId);
		const kernelResult = await kernel.backfillMigrationVisuals({ dryRun: input.dryRun });

		return {
			...kernelResult,
			workspaceColor: {
				after: normalizedColor,
				before: workspace.color,
				updated: shouldUpdateColor,
			},
			workspaceIcon: {
				after: normalizedIcon,
				before: workspace.icon,
				updated: shouldUpdateIcon,
			},
			workspaceId: input.workspaceId,
		};
	} finally {
		await dbContext.dispose();
	}
}

function parseTimestamp(value: string) {
	const parsed = new Date(value);

	if (Number.isNaN(parsed.getTime())) {
		throw new Error(`Invalid migration timestamp: ${value}`);
	}

	return parsed;
}

function parseNullableTimestamp(value: string | null | undefined) {
	return value ? parseTimestamp(value) : null;
}
