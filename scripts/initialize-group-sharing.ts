/**
 * Seed opt-in sharing preferences for current study-group memberships.
 * Existing and future preferences default to disabled.
 */
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { getNeonDatabase } from '../src/lib/server/neon/db';
import {
	authMembers,
	authOrganizations,
	organizationActivityPreferences
} from '../src/lib/server/neon/schema';

const args = new Set(process.argv.slice(2));
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const target = new URL(databaseUrl);
if (target.hostname.includes('-pooler')) throw new Error('Use a direct Neon host.');
if (args.has('--apply') && process.env.GROUP_SHARING_CONFIRMED_HOST !== target.hostname) {
	throw new Error('Set GROUP_SHARING_CONFIRMED_HOST to the exact target host before applying.');
}

const db = getNeonDatabase();
const result = await db.execute<{ count: number }>(sql`
	SELECT count(*)::int
	FROM auth.members m
	INNER JOIN auth.organizations o ON o.id = m.organization_id
	LEFT JOIN app.organization_activity_preferences p
		ON p.organization_id = m.organization_id AND p.user_id = m.user_id
	WHERE o.org_type = 'group' AND p.user_id IS NULL
`);
const count = Number(result.rows[0]?.count ?? 0);
console.log(
	`${args.has('--apply') ? 'APPLY' : 'DRY RUN'} group sharing initialization on ${target.hostname}; rows=${count}`
);
if (!args.has('--apply')) process.exit(0);

const members = await db
	.select({
		organizationId: authMembers.organizationId,
		userId: authMembers.userId
	})
	.from(authMembers)
	.innerJoin(authOrganizations, eq(authOrganizations.id, authMembers.organizationId))
	.where(eq(authOrganizations.orgType, 'group'));
if (members.length) {
	const now = new Date();
	await db
		.insert(organizationActivityPreferences)
		.values(
			members.map((member) => ({
				...member,
				enabled: false,
				createdAt: now,
				updatedAt: now
			}))
		)
		.onConflictDoNothing();
}
console.log(`Initialized ${count} group sharing preferences; all remain disabled.`);
