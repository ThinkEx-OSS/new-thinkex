import { defineConfig } from "drizzle-kit";

function getDatabaseUrl() {
	const url = process.env.DATABASE_URL?.trim();

	if (!url) {
		throw new Error("DATABASE_URL is required for Drizzle CLI commands.");
	}

	return url;
}

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: getDatabaseUrl(),
	},
});
