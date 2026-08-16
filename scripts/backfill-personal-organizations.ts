/**
 * Create a personal organization for every auth user who does not have one.
 *
 *   bun scripts/backfill-personal-organizations.ts
 */
import 'dotenv/config';
import { getNeonDatabase } from '../src/lib/server/neon/db';
import { authUsers } from '../src/lib/server/neon/schema';
import {
	ensurePersonalOrganization,
	findPersonalOrganization
} from '../src/lib/auth/organization-queries.server.ts';

async function main(): Promise<void> {
	const db = getNeonDatabase();
	const users = await db.select({ id: authUsers.id }).from(authUsers);
	let created = 0;
	let existing = 0;

	for (const user of users) {
		const already = await findPersonalOrganization(user.id);
		if (already) {
			existing += 1;
			continue;
		}
		await ensurePersonalOrganization(user.id);
		created += 1;
	}

	console.log(
		`Personal orgs ready. created=${created} already_present=${existing} users=${users.length}`
	);
}

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
