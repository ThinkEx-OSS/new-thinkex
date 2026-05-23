import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import * as schema from "./schema";

const HYPERDRIVE_BINDING_NAME = "HYPERDRIVE";
const DATABASE_DRIVER_ENV_KEY = "THINKEX_DB_DRIVER";

async function getBindingConnectionString() {
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

function getDirectConnectionString() {
	return process.env.DATABASE_URL?.trim() || null;
}

function shouldUseHyperdrive() {
	return (
		process.env[DATABASE_DRIVER_ENV_KEY]?.trim().toLowerCase() === "hyperdrive"
	);
}

export async function getRuntimeConnectionString() {
	const connectionString = shouldUseHyperdrive()
		? await getBindingConnectionString()
		: getDirectConnectionString();

	if (!connectionString) {
		throw new Error(
			[
				"No database connection string is configured.",
				`Set DATABASE_URL for local development,`,
				`or set ${DATABASE_DRIVER_ENV_KEY}=hyperdrive with the ${HYPERDRIVE_BINDING_NAME} binding.`,
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
