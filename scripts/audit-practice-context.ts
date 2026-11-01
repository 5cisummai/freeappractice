/**
 * Read-only preflight for the classroom context rollout.
 *
 *   bun run classroom:audit
 *
 * The command exits nonzero when existing classroom-owned data or duplicate
 * personal workspaces make an automatic backfill unsafe.
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getNeonDatabase } from '../src/lib/server/neon/db';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const target = new URL(databaseUrl);
if (target.hostname.includes('-pooler')) throw new Error('Use a direct Neon host for the audit.');

const db = getNeonDatabase();
const organizationRows = await db.execute<{
	orgType: string;
	count: number;
}>(sql`SELECT org_type AS "orgType", count(*)::int
	FROM auth.organizations GROUP BY org_type ORDER BY org_type`);
const practiceRows = await db.execute<{
	tableName: string;
	organizationId: string | null;
	count: number;
}>(sql`SELECT 'mcq_attempts' AS "tableName", organization_id AS "organizationId", count(*)::int
	FROM app.mcq_attempts GROUP BY organization_id
	UNION ALL SELECT 'quiz_attempts', organization_id, count(*)::int
	FROM app.quiz_attempts GROUP BY organization_id
	UNION ALL SELECT 'exam_attempts', organization_id, count(*)::int
	FROM app.exam_attempts GROUP BY organization_id
	UNION ALL SELECT 'frq_attempts', organization_id, count(*)::int
	FROM app.frq_attempts GROUP BY organization_id
	UNION ALL SELECT 'user_progress', organization_id, count(*)::int
	FROM app.user_progress GROUP BY organization_id
	UNION ALL SELECT 'bookmarks', organization_id, count(*)::int
	FROM app.bookmarks GROUP BY organization_id`);
const duplicatePersonalRows = await db.execute<{ userId: string; count: number }>(sql`
	SELECT m.user_id AS "userId", count(*)::int
	FROM auth.members m
	INNER JOIN auth.organizations o ON o.id = m.organization_id
	WHERE o.org_type = 'personal' AND m.role = 'owner'
	GROUP BY m.user_id
	HAVING count(*) > 1
`);

const classroomData = practiceRows.rows.filter((row) => row.organizationId !== null);
const ambiguous = organizationRows.rows.filter(
	(row) => row.orgType === 'school' || row.orgType === 'enterprise'
);
console.log(
	JSON.stringify(
		{
			targetHost: target.hostname,
			organizations: organizationRows.rows,
			practiceRows: practiceRows.rows,
			duplicatePersonalOwners: duplicatePersonalRows.rows,
			ambiguousOrganizations: ambiguous,
			classroomOwnedPracticeRows: classroomData
		},
		null,
		2
	)
);

if (ambiguous.length || duplicatePersonalRows.rows.length || classroomData.length) {
	console.error(
		'Context audit found ambiguous existing organization-owned data; stop before backfill.'
	);
	process.exitCode = 2;
}
