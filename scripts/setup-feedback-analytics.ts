/** Provision the PostHog importer after applying the reviewed view migration.
 * DATABASE_URL must be the confirmed direct production URL. Never prints secrets.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const url = new URL(process.env.DATABASE_URL ?? '');
const expectedHost = process.env.FEEDBACK_ANALYTICS_CONFIRMED_HOST;
const credentialFile = process.env.FEEDBACK_ANALYTICS_CREDENTIAL_FILE;
if (!expectedHost || url.hostname !== expectedHost || url.hostname.includes('-pooler')) {
	throw new Error(
		'Set DATABASE_URL to the direct target and confirm FEEDBACK_ANALYTICS_CONFIRMED_HOST.'
	);
}
if (!credentialFile || resolve(credentialFile).startsWith(`${process.cwd()}/`)) {
	throw new Error('FEEDBACK_ANALYTICS_CREDENTIAL_FILE must be outside the repository.');
}
if (!process.argv.includes('--apply'))
	throw new Error('Pass --apply after reviewing the target and migration.');
const sql = neon(url.toString());
const role = 'posthog_feedback_reader';
const existing = await sql`SELECT 1 FROM pg_roles WHERE rolname = ${role}`;
if (existing.length)
	throw new Error('Importer role already exists. Audit it before reusing or rotating it.');
const password = randomBytes(32).toString('hex');
const database = decodeURIComponent(url.pathname.slice(1)).replaceAll('"', '""');
// All interpolated SQL below is fixed, identifier-escaped, or generated hexadecimal.
// The audit runs under the proposed role inside the same transaction. Failure
// rolls back role creation and grants, without changing PUBLIC privileges.
const audit = `DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
 AND c.relkind IN ('r','p','v','m','f') AND (
 (has_table_privilege(current_user,c.oid,'SELECT') AND NOT (n.nspname='feedback_analytics' AND c.relname IN ('feedback','bug_reports')))
 OR has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))) THEN
 RAISE EXCEPTION 'Importer inherits access outside approved read-only views'; END IF;
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND has_schema_privilege(current_user,oid,'CREATE')) THEN
 RAISE EXCEPTION 'Importer inherits schema CREATE access'; END IF;
 END $$`;
url.username = role;
url.password = password;
url.searchParams.set('sslmode', 'verify-full');
await mkdir(dirname(resolve(credentialFile)), { recursive: true, mode: 0o700 });
const privateDirectory = await realpath(dirname(resolve(credentialFile)));
const repository = await realpath(process.cwd());
if (privateDirectory === repository || privateDirectory.startsWith(`${repository}/`)) {
	throw new Error('Credential directory resolves inside the repository.');
}
await writeFile(credentialFile, `${url.toString()}\n`, { mode: 0o600, flag: 'wx' });
await sql.transaction([
	sql.query(
		`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`
	),
	sql.query(`GRANT CONNECT ON DATABASE "${database}" TO ${role}`),
	sql.query(`GRANT USAGE ON SCHEMA feedback_analytics TO ${role}`),
	sql.query(
		`GRANT SELECT ON feedback_analytics.feedback, feedback_analytics.bug_reports TO ${role}`
	),
	sql.query(`GRANT ${role} TO CURRENT_USER`),
	sql.query(`SET LOCAL ROLE ${role}`),
	sql.query(audit),
	sql.query('SELECT id FROM feedback_analytics.feedback LIMIT 0'),
	sql.query('SELECT id FROM feedback_analytics.bug_reports LIMIT 0'),
	sql.query('RESET ROLE'),
	sql.query(`REVOKE ${role} FROM CURRENT_USER`)
]);
console.log('Restricted importer provisioned. Credentials saved to the specified private file.');
