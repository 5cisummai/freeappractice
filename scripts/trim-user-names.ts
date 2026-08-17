/** Trim existing auth user names to the application maximum.
 *
 * Run this before applying the migration that changes auth.users.name to varchar(64):
 *
 *   bun run auth:trim-user-names
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getNeonDatabase } from '../src/lib/server/neon/db';
import { authUsers } from '../src/lib/server/neon/schema';
import { MAX_NAME_LENGTH } from '../src/lib/auth/name-policy';

async function main(): Promise<void> {
	if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

	const updated = await getNeonDatabase()
		.update(authUsers)
		.set({
			name: sql<string>`substring(${authUsers.name} from 1 for ${MAX_NAME_LENGTH})`,
			updatedAt: new Date()
		})
		.where(sql`char_length(${authUsers.name}) > ${MAX_NAME_LENGTH}`)
		.returning({ id: authUsers.id });

	console.log(`Trimmed ${updated.length} user name(s) to ${MAX_NAME_LENGTH} characters.`);
}

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
