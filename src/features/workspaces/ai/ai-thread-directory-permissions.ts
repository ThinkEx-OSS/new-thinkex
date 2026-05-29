import { createDbContext } from "#/db/server";
import { canReadWorkspace } from "#/features/workspaces/server/permissions";

export async function assertCanReadWorkspace({
	userId,
	workspaceId,
}: {
	userId: string;
	workspaceId: string;
}) {
	const dbContext = await createDbContext();

	try {
		const allowed = await canReadWorkspace(dbContext.db, {
			workspaceId,
			userId,
		});

		if (!allowed) {
			throw new Error("Forbidden");
		}
	} finally {
		await dbContext.dispose();
	}
}
