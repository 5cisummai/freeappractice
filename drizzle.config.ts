import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/server/neon/schema.ts',
	out: './drizzle',
	strict: true,
	verbose: true,
	dbCredentials: {
		url: process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? ''
	}
});
