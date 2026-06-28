import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { createDbContext } from "#/db/server";
import { listWorkspacesForUser } from "#/features/workspaces/server/queries";
import { sendWorkspaceMigrationRequestEmail } from "#/features/workspaces/migration-request-email";
import { WorkspaceAuthError } from "#/features/workspaces/server/permissions";
import { getSessionFromHeaders } from "#/lib/auth-queries.server";

export const requestWorkspaceMigrationFn = createServerFn({ method: "POST" }).handler(async () => {
	const session = await getSessionFromHeaders(getRequestHeaders());
	const user = session?.user;

	if (!user) {
		throw new WorkspaceAuthError();
	}

	const dbContext = await createDbContext();

	try {
		const workspaces = await listWorkspacesForUser(dbContext.db, user.id);
		const result = await sendWorkspaceMigrationRequestEmail({
			userId: user.id,
			userEmail: user.email,
			userName: user.name,
			workspaceCount: workspaces.length,
		});

		if (!result.ok) {
			throw new Error("Unable to send migration request email.");
		}

		return { ok: true };
	} finally {
		await dbContext.dispose();
	}
});
