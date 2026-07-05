import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL ?? process.env.DRIZZLE_DATABASE_URL ?? 'postgres://monden:monden@localhost:5432/monden';

export default defineConfig({
	out: './drizzle',
	schema: './app/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: {
		url: databaseUrl,
	},
	verbose: true,
	strict: true,
});
