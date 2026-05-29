import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import * as schema from "./schema";

const HYPERDRIVE_BINDING_NAME = "HYPERDRIVE";
const DATABASE_DRIVER_ENV_KEY = "THINKEX_DB_DRIVER";

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

function shouldUseHyperdriveBinding() {
	return (
		process.env[DATABASE_DRIVER_ENV_KEY]?.trim().toLowerCase() === "hyperdrive"
	);
}

async function getRuntimeConnectionString() {
	const connectionString = shouldUseHyperdriveBinding()
		? await getHyperdriveConnectionString()
		: getDatabaseUrlConnectionString();

	if (!connectionString) {
		throw new Error(
			[
				"No database connection string is configured.",
				"Normal local development uses DATABASE_URL.",
				`Cloudflare Worker deployments use ${DATABASE_DRIVER_ENV_KEY}=hyperdrive with the ${HYPERDRIVE_BINDING_NAME} binding.`,
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
