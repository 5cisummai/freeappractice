/**
 * Read-only post-migration verification. Fails on isolation or uniqueness
 * violations and optionally compares counts from a JSON baseline.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { getNeonDatabase } from '../src/lib/server/neon/db';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const target = new URL(databaseUrl);
if (target.hostname.includes('-pooler')) throw new Error('Use a direct Neon host.');
const db = getNeonDatabase();

const result = await db.execute<{
	tableName: string;
	total: number;
	personal: number;
	classroom: number;
}>(
	sql`SELECT 'mcq_attempts' AS "tableName", count(*)::int AS total,
		count(*) FILTER (WHERE organization_id IS NULL)::int AS personal,
		count(*) FILTER (WHERE organization_id IS NOT NULL)::int AS classroom
	FROM app.mcq_attempts
	UNION ALL SELECT 'quiz_attempts', count(*)::int,
		count(*) FILTER (WHERE organization_id IS NULL)::int,
		count(*) FILTER (WHERE organization_id IS NOT NULL)::int
	FROM app.quiz_attempts
	UNION ALL SELECT 'exam_attempts', count(*)::int,
		count(*) FILTER (WHERE organization_id IS NULL)::int,
		count(*) FILTER (WHERE organization_id IS NOT NULL)::int
	FROM app.exam_attempts
	UNION ALL SELECT 'frq_attempts', count(*)::int,
		count(*) FILTER (WHERE organization_id IS NULL)::int,
		count(*) FILTER (WHERE organization_id IS NOT NULL)::int
	FROM app.frq_attempts
	UNION ALL SELECT 'user_progress', count(*)::int,
		count(*) FILTER (WHERE organization_id IS NULL)::int,
		count(*) FILTER (WHERE organization_id IS NOT NULL)::int
	FROM app.user_progress
	UNION ALL SELECT 'bookmarks', count(*)::int,
		count(*) FILTER (WHERE organization_id IS NULL)::int,
		count(*) FILTER (WHERE organization_id IS NOT NULL)::int
	FROM app.bookmarks`
);
const duplicateRows = await db.execute(sql`
	SELECT user_id, course, unit, count(*)::int
	FROM app.user_progress
	WHERE organization_id IS NULL
	GROUP BY user_id, course, unit
	HAVING count(*) > 1
	UNION ALL
	SELECT user_id, question_id, '', count(*)::int
	FROM app.bookmarks
	WHERE organization_id IS NULL
	GROUP BY user_id, question_id
	HAVING count(*) > 1
`);
const classroomFeedRows = await db.execute<{ count: number }>(sql`
	SELECT count(*)::int
	FROM app.practice_activity_audiences a
	INNER JOIN auth.organizations o ON o.id = a.organization_id
	WHERE o.org_type = 'school'
`);
const orphanAudienceRows = await db.execute<{ count: number }>(sql`
	SELECT count(*)::int
	FROM app.practice_activity_audiences a
	LEFT JOIN auth.members m
		ON m.organization_id = a.organization_id
		AND m.user_id = (SELECT user_id FROM app.practice_activity_events WHERE id = a.event_id)
	WHERE m.id IS NULL
`);

const baselineIndex = process.argv.indexOf('--baseline');
if (baselineIndex !== -1) {
	const baselinePath = process.argv[baselineIndex + 1];
	if (!baselinePath) throw new Error('--baseline requires a JSON file.');
	const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as {
		practiceRows?: Array<{ tableName: string; count: number }>;
	};
	for (const row of baseline.practiceRows ?? []) {
		const current = result.rows.find((candidate) => candidate.tableName === row.tableName);
		if (current && Number(current.total) !== Number(row.count)) {
			throw new Error(`Row count changed for ${row.tableName}: ${row.count} -> ${current.total}`);
		}
	}
}

console.log(
	JSON.stringify(
		{
			targetHost: target.hostname,
			rows: result.rows,
			duplicateRows: duplicateRows.rows,
			classroomFeedRows: classroomFeedRows.rows[0]?.count ?? 0,
			orphanAudienceRows: orphanAudienceRows.rows[0]?.count ?? 0
		},
		null,
		2
	)
);

if (
	duplicateRows.rows.length ||
	Number(classroomFeedRows.rows[0]?.count ?? 0) > 0 ||
	Number(orphanAudienceRows.rows[0]?.count ?? 0) > 0
) {
	throw new Error('Practice context verification failed.');
}
