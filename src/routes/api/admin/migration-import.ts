import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

import { createDbContext } from "#/db/server";
import * as schema from "#/db/schema";
import { getWorkspaceKernelFromEnv } from "#/features/workspaces/kernel/workspace-kernel-access";
import { convertLegacyOcrPages } from "#/features/workspaces/migration/legacy-ocr-pages";
import type {
	MigrationPayload,
	MigrationWorkspace,
	MigrationItem,
	MigrationFileItem,
} from "#/features/workspaces/migration/migration-payload";
import { serializeMarkdownPagesProjection } from "#/features/workspaces/extraction/page-markdown-projection";
import { apiError, apiJson, getRequestId } from "#/lib/api/http";

async function handleMigrationImport(request: Request) {
	const requestId = getRequestId(request);

	try {
		const secret = env.MIGRATION_IMPORT_SECRET;

		if (!secret) {
			return apiError(requestId, 503, "NOT_CONFIGURED", "Migration import is not configured.");
		}

		const provided =
			request.headers.get("x-migration-secret") ?? request.headers.get("authorization");

		if (!provided || provided !== secret) {
			return apiError(requestId, 401, "UNAUTHORIZED", "Invalid migration secret.");
		}

		const payload = (await request.json()) as MigrationPayload;

		if (!payload.user?.id || !payload.account?.id || !Array.isArray(payload.workspaces)) {
			return apiError(requestId, 400, "INVALID_PAYLOAD", "Missing required payload fields.");
		}

		const dbContext = await createDbContext();

		try {
			const db = dbContext.db;

			const existingUser = await db
				.select({ id: schema.user.id })
				.from(schema.user)
				.where(eq(schema.user.id, payload.user.id))
				.get();

			if (!existingUser) {
				await db.insert(schema.user).values({
					id: payload.user.id,
					name: payload.user.name,
					email: payload.user.email,
					emailVerified: payload.user.emailVerified,
					image: payload.user.image,
					createdAt: new Date(payload.user.createdAt),
					updatedAt: new Date(payload.user.updatedAt),
				});
			}

			const existingAccount = await db
				.select({ id: schema.account.id })
				.from(schema.account)
				.where(eq(schema.account.id, payload.account.id))
				.get();

			if (!existingAccount) {
				await db.insert(schema.account).values({
					id: payload.account.id,
					accountId: payload.account.accountId,
					providerId: payload.account.providerId,
					userId: payload.account.userId,
					accessToken: payload.account.accessToken,
					refreshToken: payload.account.refreshToken,
					idToken: payload.account.idToken,
					scope: payload.account.scope,
					createdAt: new Date(payload.account.createdAt),
					updatedAt: new Date(payload.account.updatedAt),
				});
			}

			const results: Array<{
				workspaceId: string;
				status: "created" | "skipped";
				itemsCreated: number;
				itemsSkipped: number;
			}> = [];

			for (const workspace of payload.workspaces) {
				const wsResult = await importWorkspace(workspace, payload.user.id);
				results.push(wsResult);
			}

			return apiJson({ ok: true, results }, requestId);
		} finally {
			await dbContext.dispose();
		}
	} catch (error) {
		return apiError(
			requestId,
			500,
			"IMPORT_FAILED",
			"Migration import failed.",
			error instanceof Error ? { message: error.message } : undefined,
		);
	}
}

async function importWorkspace(
	workspace: MigrationWorkspace,
	userId: string,
): Promise<{
	workspaceId: string;
	status: "created" | "skipped";
	itemsCreated: number;
	itemsSkipped: number;
}> {
	const dbContext = await createDbContext();

	try {
		const db = dbContext.db;

		const existing = await db
			.select({ id: schema.workspaces.id })
			.from(schema.workspaces)
			.where(eq(schema.workspaces.id, workspace.id))
			.get();

		if (existing) {
			return {
				workspaceId: workspace.id,
				status: "skipped",
				itemsCreated: 0,
				itemsSkipped: workspace.items.length,
			};
		}

		await db.insert(schema.workspaces).values({
			id: workspace.id,
			name: workspace.name,
			description: workspace.description,
			icon: workspace.icon,
			color: workspace.color,
			ownerId: userId,
			createdAt: new Date(workspace.createdAt),
			updatedAt: new Date(workspace.updatedAt),
		});

		const memberId = crypto.randomUUID();
		await db.insert(schema.workspaceMembers).values({
			id: memberId,
			workspaceId: workspace.id,
			userId,
			role: "owner",
			lastOpenedAt: workspace.lastOpenedAt ? new Date(workspace.lastOpenedAt) : null,
			createdAt: new Date(workspace.createdAt),
			updatedAt: new Date(workspace.updatedAt),
		});

		const kernel = await getWorkspaceKernelFromEnv(env, workspace.id);
		let itemsCreated = 0;
		let itemsSkipped = 0;

		const oldToNewId = new Map<string, string>();

		const sortedItems = sortItemsByDependency(workspace.items);

		for (const item of sortedItems) {
			try {
				const resolvedParentId = resolveParentId(item, oldToNewId);

				if (item.type === "folder") {
					const existing = await checkItemExists(kernel, item.id);

					if (existing) {
						oldToNewId.set(item.id, item.id);
						itemsSkipped++;
						continue;
					}

					await kernel.createItem({
						id: item.id,
						parentId: resolvedParentId,
						type: "folder",
						name: item.name,
						color: item.color ?? undefined,
						actorUserId: userId,
					});
					oldToNewId.set(item.id, item.id);
					itemsCreated++;
				} else if (item.type === "document") {
					const existing = await checkItemExists(kernel, item.id);

					if (existing) {
						oldToNewId.set(item.id, item.id);
						itemsSkipped++;
						continue;
					}

					await kernel.createItem({
						id: item.id,
						parentId: resolvedParentId,
						type: "document",
						name: item.name,
						metadataJson: item.metadataJson,
						initialContent: item.content,
						actorUserId: userId,
					});
					oldToNewId.set(item.id, item.id);
					itemsCreated++;
				} else if (item.type === "file") {
					const newItem = await importFileItem(
						item,
						workspace.id,
						resolvedParentId,
						userId,
						kernel,
					);

					if (newItem) {
						oldToNewId.set(item.id, newItem.id);
						itemsCreated++;
					} else {
						itemsSkipped++;
					}
				}
			} catch (error) {
				console.error(`[MigrationImport] Failed to import item ${item.id}:`, error);
				itemsSkipped++;
			}
		}

		return { workspaceId: workspace.id, status: "created", itemsCreated, itemsSkipped };
	} finally {
		await dbContext.dispose();
	}
}

async function importFileItem(
	item: MigrationFileItem,
	workspaceId: string,
	parentId: string | null,
	userId: string,
	kernel: Awaited<ReturnType<typeof getWorkspaceKernelFromEnv>>,
) {
	const bytes = Uint8Array.from(atob(item.bytesBase64), (c) => c.charCodeAt(0));
	const objectKey = `uploads/workspaces/${workspaceId}/${crypto.randomUUID()}/source`;

	await env.WORKSPACE_KERNEL_FILES.put(objectKey, bytes, {
		httpMetadata: { contentType: item.contentType },
	});

	const command = await kernel.createFileFromUpload({
		parentId,
		fileName: item.fileName,
		fileSize: item.sizeBytes,
		objectKey,
		contentType: item.contentType,
		assetKind: item.assetKind,
		actorUserId: userId,
	});

	if (item.ocrPages && item.ocrPages.length > 0) {
		const pages = convertLegacyOcrPages(item.ocrPages);

		if (pages.length > 0) {
			await kernel.upsertFileProjection({
				itemId: command.result.id,
				format: "pages",
				status: "ready",
				content: serializeMarkdownPagesProjection(pages),
			});
		}
	}

	return command.result;
}

function sortItemsByDependency(items: MigrationItem[]): MigrationItem[] {
	const itemMap = new Map<string, MigrationItem>();

	for (const item of items) {
		itemMap.set(item.id, item);
	}

	const sorted: MigrationItem[] = [];
	const visited = new Set<string>();

	function visit(item: MigrationItem) {
		if (visited.has(item.id)) {
			return;
		}

		visited.add(item.id);

		if (item.parentId && itemMap.has(item.parentId)) {
			visit(itemMap.get(item.parentId)!);
		}

		sorted.push(item);
	}

	for (const item of items) {
		visit(item);
	}

	return sorted;
}

function resolveParentId(item: MigrationItem, oldToNewId: Map<string, string>): string | null {
	if (!item.parentId) {
		return null;
	}

	return oldToNewId.get(item.parentId) ?? item.parentId;
}

async function checkItemExists(
	kernel: Awaited<ReturnType<typeof getWorkspaceKernelFromEnv>>,
	itemId: string,
): Promise<boolean> {
	try {
		const result = await kernel.readItem({ itemId });
		return !!result?.item;
	} catch {
		return false;
	}
}

export const Route = createFileRoute("/api/admin/migration-import")({
	server: {
		handlers: {
			POST: ({ request }) => handleMigrationImport(request),
		},
	},
});
