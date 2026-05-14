import { env as workerEnv } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import * as schema from "./schema";

const HYPERDRIVE_BINDING_NAME = "HYPERDRIVE";
const LOCAL_HYPERDRIVE_ENV_KEY =
	"CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE";

function getBindingConnectionString() {
	const bindings = workerEnv as Record<string, unknown>;
	const hyperdrive = bindings[HYPERDRIVE_BINDING_NAME] as
		| { connectionString?: string }
		| undefined;

	return hyperdrive?.connectionString?.trim() || null;
}

function getLocalHyperdriveConnectionString() {
	return process.env[LOCAL_HYPERDRIVE_ENV_KEY]?.trim() || null;
}

function getDirectConnectionString() {
	return process.env.DATABASE_URL?.trim() || null;
}

export function getRuntimeConnectionString() {
	const connectionString =
		getBindingConnectionString() ||
		getLocalHyperdriveConnectionString() ||
		getDirectConnectionString();

	if (!connectionString) {
		throw new Error(
			[
				"No database connection string is configured.",
				`Set the ${HYPERDRIVE_BINDING_NAME} Hyperdrive binding for the Worker runtime,`,
				`or ${LOCAL_HYPERDRIVE_ENV_KEY} for local Hyperdrive development,`,
				"or DATABASE_URL for direct local Postgres access.",
			].join(" "),
		);
	}

	return connectionString;
}

export async function createDbContext() {
	const client = new Client({
		connectionString: getRuntimeConnectionString(),
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
