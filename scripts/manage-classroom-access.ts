/**
 * Grant or revoke classroom-creation access.
 *
 * Dry run:
 *   bun run classroom:access -- --user-id USER_ID
 * Apply:
 *   CLASSROOM_ACCESS_CONFIRMED_HOST=... bun run classroom:access -- --apply --user-id USER_ID
 */
import 'dotenv/config';
import {
	grantClassroomCreationAccess,
	revokeClassroomCreationAccess
} from '../src/lib/auth/organization-queries.server';

const args = new Set(process.argv.slice(2));
const userIndex = process.argv.indexOf('--user-id');
const userId = userIndex >= 0 ? process.argv[userIndex + 1]?.trim() : '';
const action = args.has('--revoke') ? 'revoke' : 'grant';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const target = new URL(databaseUrl);
const confirmedHost = process.env.CLASSROOM_ACCESS_CONFIRMED_HOST;
if (target.hostname.includes('-pooler')) {
	throw new Error('Use a direct Neon host for classroom access operations.');
}
if (!userId) throw new Error('Pass --user-id USER_ID.');
if (args.has('--apply') && (!confirmedHost || confirmedHost !== target.hostname)) {
	throw new Error('Set CLASSROOM_ACCESS_CONFIRMED_HOST to the exact target host before applying.');
}

console.log(
	`${args.has('--apply') ? 'APPLY' : 'DRY RUN'} ${action} classroom creation access for ${userId} on ${target.hostname}`
);
if (!args.has('--apply')) process.exit(0);

const operatorId = process.env.CLASSROOM_ACCESS_OPERATOR_ID;
if (!operatorId) throw new Error('CLASSROOM_ACCESS_OPERATOR_ID is required when applying.');
if (action === 'grant') await grantClassroomCreationAccess(userId, operatorId);
else await revokeClassroomCreationAccess(userId);
console.log(
	`${action === 'grant' ? 'Granted' : 'Revoked'} classroom creation access for ${userId}.`
);
