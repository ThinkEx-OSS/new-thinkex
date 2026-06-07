import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import * as schema from "./schema";

const HYPERDRIVE_BINDING_NAME = "HYPERDRIVE";

async function getHyperdriveConnectionString() {
	let workerEnv: unknown;

	try {
		({ env: workerEnv } = await import("cloudflare:workers"));
	} catch {
		return null;
	}

	const bindings = workerEnv as unknown as Record<string, unknown>;
	const hyperdrive = bindings[HYPERDRIVE_BINDING_NAME] as
		| { connectionString?: string }
		| undefined;

	return hyperdrive?.connectionString?.trim() || null;
}

function getDatabaseUrlConnectionString() {
	return process.env.DATABASE_URL?.trim() || null;
}

async function getRuntimeConnectionString() {
	const connectionString =
		(await getHyperdriveConnectionString()) ?? getDatabaseUrlConnectionString();

	if (!connectionString) {
		throw new Error(
			[
				"No database connection string is configured.",
				`Cloudflare Worker deployments use the ${HYPERDRIVE_BINDING_NAME} binding.`,
				"Local development uses DATABASE_URL.",
			].join(" "),
		);
	}

	return connectionString;
}

export async function createDbContext() {
	const client = new Client({
		connectionString: await getRuntimeConnectionString(),
	});

	await client.connect();

	return {
		client,
		db: drizzle(client, { schema }),
		dispose: async () => {
			await client.end();
		},
	};
}
