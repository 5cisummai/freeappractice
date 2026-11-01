/** Read-only SQL verification; no reports or schema objects are created. */
import assert from 'node:assert/strict';
import { neon } from '@neondatabase/serverless';
import { getViewConfig, PgDialect } from 'drizzle-orm/pg-core';
import { feedbackAnalyticsReports } from '../src/lib/server/neon/schema/feedback-analytics';
import { formatAppFeedbackMessageForStorage } from '../src/lib/schemas/app-feedback';

const sql = neon(process.env.DATABASE_URL!);
const definition = getViewConfig(feedbackAnalyticsReports).query!;
const query = new PgDialect().sqlToQuery(definition).sql.replace('app.app_feedback', 'fixture');
const report = 'The explanation is confusing.';
const cases = [
	{ stored: report, expected: report, userId: 'student-1' },
	{ stored: report, expected: report, userId: null },
	{
		stored: formatAppFeedbackMessageForStorage({
			category: 'general',
			message: report,
			coachMessageId: 'message-1',
			chatHistory: [{ role: 'user', content: 'PRIVATE_TRANSCRIPT_SENTINEL' }]
		}),
		expected: formatAppFeedbackMessageForStorage({
			category: 'general',
			message: report,
			coachMessageId: 'message-1'
		}),
		userId: 'student-1'
	},
	{
		stored: `${report}\n\n---\nIncluded chat history:\nTyped by reporter`,
		expected: `${report}\n\n---\nIncluded chat history:\nTyped by reporter`,
		userId: null
	}
];
for (const example of cases) {
	const rows = await sql.query(
		`WITH fixture AS (SELECT 'test'::text id, $1::text user_id,
	'general'::text category, now() created_at, $2::text message) ${query}`,
		[example.userId, example.stored]
	);
	assert.equal(rows.length, 1);
	assert.equal(rows[0].message, example.expected);
	assert.equal(rows[0].user_id, example.userId);
	assert.ok(!rows[0].message.includes('PRIVATE_TRANSCRIPT_SENTINEL'));
}
console.log('Passed 4 read-only SQL transformation and identity cases.');

// Optional transactional migration/privilege test on an isolated database only.
// Explicit ROLLBACK ensures no schema, role, or report survives this test.
const migrationIndex = process.argv.indexOf('--migration');
if (migrationIndex !== -1) {
	const { readFile } = await import('node:fs/promises');
	const { randomBytes } = await import('node:crypto');
	const migration = await readFile(process.argv[migrationIndex + 1], 'utf8');
	const role = `feedback_test_${randomBytes(8).toString('hex')}`;
	await sql.transaction([
		...migration
			.split('--> statement-breakpoint')
			.filter((part) => part.trim())
			.map((part) => sql.query(part)),
		sql.query(
			`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`
		),
		sql.query(`GRANT USAGE ON SCHEMA feedback_analytics TO ${role}`),
		sql.query(
			`GRANT SELECT ON feedback_analytics.feedback, feedback_analytics.bug_reports TO ${role}`
		),
		sql.query(`GRANT ${role} TO CURRENT_USER`),
		sql.query(`SET LOCAL ROLE ${role}`),
		sql.query('SELECT id, user_id, message FROM feedback_analytics.feedback LIMIT 0'),
		sql.query('SELECT id, user_id, description FROM feedback_analytics.bug_reports LIMIT 0'),
		sql.query(`DO $$ BEGIN
			BEGIN PERFORM id FROM app.app_feedback LIMIT 0; RAISE EXCEPTION 'Original feedback exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
			BEGIN PERFORM id FROM app.bug_reports LIMIT 0; RAISE EXCEPTION 'Original bugs exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
			BEGIN PERFORM id FROM auth.users LIMIT 0; RAISE EXCEPTION 'Account data exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
			IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='feedback_analytics' AND column_name IN ('email','metadata')) THEN RAISE EXCEPTION 'Excluded columns exposed'; END IF;
			IF has_table_privilege(current_user,'feedback_analytics.feedback','INSERT,UPDATE,DELETE') OR has_table_privilege(current_user,'feedback_analytics.bug_reports','INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Write access exposed'; END IF;
		END $$`),
		sql.query('ROLLBACK')
	]);
	console.log('Passed migration and restricted-role checks; transaction rolled back.');
}
