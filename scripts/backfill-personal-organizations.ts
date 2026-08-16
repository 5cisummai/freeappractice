/**
 * Create a personal organization for every auth user who does not have one,
 * and rename existing personal orgs to "My Space".
 *
 *   bun run auth:backfill-personal-orgs
 */
import 'dotenv/config';
import { and, eq, ne } from 'drizzle-orm';
import { getNeonDatabase } from '../src/lib/server/neon/db';
import { authMembers, authOrganizations, authUsers } from '../src/lib/server/neon/schema';
import { ensurePersonalOrganization } from '../src/lib/auth/organization-queries.server.ts';
import { PERSONAL_ORG_NAME } from '../src/lib/auth/organization-types';

async function main(): Promise<void> {
	const db = getNeonDatabase();
	const renamed = await db
		.update(authOrganizations)
		.set({ name: PERSONAL_ORG_NAME, updatedAt: new Date() })
		.where(
			and(eq(authOrganizations.orgType, 'personal'), ne(authOrganizations.name, PERSONAL_ORG_NAME))
		)
		.returning({ id: authOrganizations.id });

	const users = await db.select({ id: authUsers.id }).from(authUsers);
	const existingPersonalOwners = new Set(
		(
			await db
				.select({ userId: authMembers.userId })
				.from(authMembers)
				.innerJoin(authOrganizations, eq(authMembers.organizationId, authOrganizations.id))
				.where(and(eq(authOrganizations.orgType, 'personal'), eq(authMembers.role, 'owner')))
		).map((row) => row.userId)
	);
	let created = 0;
	let existing = 0;

	for (const user of users) {
		if (existingPersonalOwners.has(user.id)) {
			existing += 1;
			continue;
		}
		await ensurePersonalOrganization(user.id);
		created += 1;
	}

	console.log(
		`Personal orgs ready. created=${created} already_present=${existing} renamed=${renamed.length} users=${users.length}`
	);
}

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
