import { env as workerEnv } from "cloudflare:workers";

const migrationAuthHeader = "x-thinkex-migration-token";

export function isAuthorizedThinkexMigrationRequest(request: Request) {
	const configuredToken = (
		workerEnv as unknown as Record<string, string | undefined>
	).THINKEX_MIGRATION_ADMIN_TOKEN?.trim();

	if (!configuredToken) {
		return false;
	}

	const requestToken =
		request.headers.get(migrationAuthHeader)?.trim() ||
		getBearerToken(request.headers.get("authorization"));

	return requestToken === configuredToken;
}

export function getThinkexMigrationAuthHeader() {
	return migrationAuthHeader;
}

function getBearerToken(value: string | null) {
	if (!value) {
		return null;
	}

	const match = value.match(/^Bearer\s+(.+)$/i);
	return match?.[1]?.trim() || null;
}
