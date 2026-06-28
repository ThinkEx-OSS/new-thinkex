export {};

interface ListWorkspacesResult {
	total: number;
	workspaceIds: string[];
}

interface BackfillVisualsResult {
	failedPreviews: number;
	filesWithPreview: number;
	folderColorsUpdated: number;
	previewBackfilled: number;
	previewCandidates: number;
	previewSkippedUnsupported: number;
	workspaceColor: { updated: boolean };
	workspaceIcon: { updated: boolean };
	workspaceId: string;
}

const migrationAuthHeader = "x-thinkex-migration-token";
const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--apply");
const baseUrl = requireEnv("NEW_THINKEX_BASE_URL").replace(/\/$/, "");
const migrationToken = requireEnv("THINKEX_MIGRATION_ADMIN_TOKEN");
const concurrency = Number.parseInt(process.env.THINKEX_BACKFILL_CONCURRENCY ?? "3", 10);
const pageSize = Number.parseInt(process.env.THINKEX_BACKFILL_PAGE_SIZE ?? "1000", 10);

const totals = {
	failedPreviews: 0,
	filesWithPreview: 0,
	folderColorsUpdated: 0,
	previewBackfilled: 0,
	previewCandidates: 0,
	previewSkippedUnsupported: 0,
	workspaceColorsUpdated: 0,
	workspaceIconsUpdated: 0,
	workspacesProcessed: 0,
};

console.info(
	JSON.stringify({
		baseUrl,
		concurrency,
		dryRun,
		message: "Starting ThinkEx post-migration backfill",
	}),
);

const workspaceIds = await listWorkspaceIds();
await runWithConcurrency(workspaceIds, concurrency, async (workspaceId) => {
	const result = await command<BackfillVisualsResult>({
		type: "backfill_migration_visuals",
		input: { dryRun, workspaceId },
	});

	totals.failedPreviews += result.failedPreviews;
	totals.filesWithPreview += result.filesWithPreview;
	totals.folderColorsUpdated += result.folderColorsUpdated;
	totals.previewBackfilled += result.previewBackfilled;
	totals.previewCandidates += result.previewCandidates;
	totals.previewSkippedUnsupported += result.previewSkippedUnsupported;
	totals.workspaceColorsUpdated += result.workspaceColor.updated ? 1 : 0;
	totals.workspaceIconsUpdated += result.workspaceIcon.updated ? 1 : 0;
	totals.workspacesProcessed += 1;

	if (totals.workspacesProcessed % 25 === 0 || totals.workspacesProcessed === workspaceIds.length) {
		console.info(
			JSON.stringify({
				...totals,
				totalWorkspaces: workspaceIds.length,
				message: "Backfill progress",
			}),
		);
	}
});

console.info(
	JSON.stringify({ ...totals, dryRun, message: "ThinkEx post-migration backfill done" }),
);

async function listWorkspaceIds() {
	const workspaceIds: string[] = [];
	let offset = 0;
	let total = Number.POSITIVE_INFINITY;

	while (workspaceIds.length < total) {
		const page = await command<ListWorkspacesResult>({
			type: "list_migration_backfill_workspaces",
			input: { limit: pageSize, offset },
		});

		total = page.total;
		workspaceIds.push(...page.workspaceIds);
		offset += page.workspaceIds.length;

		if (page.workspaceIds.length === 0) {
			break;
		}
	}

	return workspaceIds;
}

async function command<T>(commandPayload: Record<string, unknown>): Promise<T> {
	const headers = new Headers({
		"content-type": "application/json",
	});
	headers.set(migrationAuthHeader, migrationToken);

	const response = await fetch(`${baseUrl}/api/v1/admin/thinkex-migration`, {
		method: "POST",
		headers,
		body: JSON.stringify({ command: commandPayload }),
	});
	const text = await response.text();

	if (!response.ok) {
		throw new Error(`Backfill command failed: ${response.status} ${text}`);
	}

	return JSON.parse(text) as T;
}

async function runWithConcurrency<T>(
	items: T[],
	limit: number,
	worker: (item: T) => Promise<void>,
) {
	let index = 0;
	const workers = Array.from({ length: Math.max(1, limit) }, async () => {
		while (index < items.length) {
			const item = items[index];
			index += 1;

			if (item !== undefined) {
				await worker(item);
			}
		}
	});

	await Promise.all(workers);
}

function requireEnv(name: string) {
	const value = process.env[name]?.trim();

	if (!value) {
		throw new Error(`${name} is required.`);
	}

	return value;
}
