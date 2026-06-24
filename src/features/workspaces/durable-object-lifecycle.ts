import { eq } from "drizzle-orm";

import { workspaces } from "#/db/schema";
import { createDbContext } from "#/db/server";
import { getUserAIStoreFromEnv } from "#/features/workspaces/ai/user-ai-store-access";
import { getWorkspaceKernel } from "#/features/workspaces/kernel/workspace-kernel-access";

async function listOwnedWorkspaceIds(userId: string) {
	const dbContext = await createDbContext();

	try {
		const rows = await dbContext.db
			.select({ id: workspaces.id })
			.from(workspaces)
			.where(eq(workspaces.ownerId, userId));

		return rows.map((row) => row.id);
	} finally {
		await dbContext.dispose();
	}
}

async function purgeUserAIStore(userId: string) {
	const { env } = await import("cloudflare:workers");

	try {
		await getUserAIStoreFromEnv(env, userId).purgeForDeletion();
	} catch (error) {
		console.warn("[DurableObjectLifecycle] UserAIStore purge failed", { userId, error });
	}
}

export async function purgeWorkspaceResources(workspaceId: string) {
	try {
		const kernel = await getWorkspaceKernel(workspaceId);
		await kernel.purgeForDeletion();
	} catch (error) {
		console.warn("[DurableObjectLifecycle] WorkspaceKernel purge failed", { workspaceId, error });
	}
}

export async function purgeUserAccountResources(userId: string) {
	const ownedWorkspaceIds = await listOwnedWorkspaceIds(userId);

	await Promise.all([
		purgeUserAIStore(userId),
		...ownedWorkspaceIds.map((workspaceId) => purgeWorkspaceResources(workspaceId)),
	]);
}
