/**
 * scripts/cleanup-unverified-users.ts
 *
 * Manually delete stale *unverified* Better Auth users (and related rows).
 * Defaults to dry-run. Never deletes a user who is verified at delete time.
 *
 *   bun run auth:cleanup-unverified
 *   bun run auth:cleanup-unverified -- --days 1
 *   bun run auth:cleanup-unverified -- --confirm --days 1
 */
import 'dotenv/config';
import { and, eq, lt, or } from 'drizzle-orm';
import { deleteAppDataDocuments } from '../src/lib/users/delete-app-data-documents.server.ts';
import { getNeonDatabase } from '../src/lib/server/neon/db';
import {
	authAccounts,
	authSessions,
	authUsers,
	authVerifications
} from '../src/lib/server/neon/schema';
import {
	assertSafeEmail,
	assertSafeUserId,
	isEligibleUnverifiedUser,
	type CleanupCandidate
} from './cleanup-unverified-users-lib';

export {
	assertSafeEmail,
	assertSafeUserId,
	isEligibleUnverifiedUser,
	unverifiedStaleFilter
} from './cleanup-unverified-users-lib';

const DEFAULT_MAX_AGE_DAYS = 1;

function getArg(flag: string): string | undefined {
	const idx = process.argv.indexOf(flag);
	return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined;
}

function parseDays(): number {
	const raw = getArg('--days');
	if (raw === undefined) return DEFAULT_MAX_AGE_DAYS;
	const days = Number(raw);
	if (!Number.isFinite(days) || days < 1) {
		console.error('Error: --days must be a number >= 1');
		process.exit(1);
	}
	return days;
}

function cutoffFromDays(days: number, now = new Date()): Date {
	return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

async function loadCandidates(cutoff: Date): Promise<CleanupCandidate[]> {
	const db = getNeonDatabase();
	const docs = await db
		.select({
			id: authUsers.id,
			email: authUsers.email,
			emailVerified: authUsers.emailVerified,
			createdAt: authUsers.createdAt
		})
		.from(authUsers)
		.where(and(eq(authUsers.emailVerified, false), lt(authUsers.createdAt, cutoff)));

	const candidates: CleanupCandidate[] = [];
	for (const doc of docs) {
		if (doc.emailVerified !== false) {
			throw new Error(
				`Safety abort: non-unverified user ${String(doc.id)} appeared in candidate set`
			);
		}
		if (!isEligibleUnverifiedUser(doc, cutoff)) {
			throw new Error(`Safety abort: query returned ineligible user ${String(doc.id)}`);
		}
		if (!(doc.createdAt instanceof Date)) {
			throw new Error(`Safety abort: candidate ${String(doc.id)} missing createdAt`);
		}
		candidates.push({
			id: assertSafeUserId(String(doc.id)),
			email: assertSafeEmail(doc.email),
			emailVerified: doc.emailVerified,
			createdAt: doc.createdAt
		});
	}
	return candidates;
}

async function deleteOneUnverifiedUser(candidate: CleanupCandidate, cutoff: Date) {
	const db = getNeonDatabase();
	const userId = assertSafeUserId(candidate.id);
	const email = assertSafeEmail(candidate.email);

	// The predicate is repeated in the DELETE so a user verified between the
	// candidate read and this call cannot be cascaded.
	const deleted = await db
		.delete(authUsers)
		.where(
			and(
				eq(authUsers.id, userId),
				eq(authUsers.email, email),
				eq(authUsers.emailVerified, false),
				lt(authUsers.createdAt, cutoff)
			)
		)
		.returning({
			id: authUsers.id,
			email: authUsers.email,
			emailVerified: authUsers.emailVerified
		});

	const deletedUser = deleted[0];
	if (!deletedUser) {
		console.log(`  skipped ${email} (${userId}) — no longer eligible`);
		return false;
	}

	if (deletedUser.emailVerified !== false) {
		throw new Error(`Safety abort: refuse to cascade-delete non-unverified user ${userId}`);
	}

	const deletedId = assertSafeUserId(String(deletedUser.id));
	const deletedEmail = assertSafeEmail(deletedUser.email ?? email);

	await Promise.all([
		db.delete(authSessions).where(eq(authSessions.userId, deletedId)),
		db.delete(authAccounts).where(eq(authAccounts.userId, deletedId)),
		db
			.delete(authVerifications)
			.where(
				or(
					eq(authVerifications.identifier, deletedEmail),
					eq(authVerifications.identifier, deletedEmail.toLowerCase())
				)
			)
	]);
	await deleteAppDataDocuments([deletedId]);

	return true;
}

async function main() {
	const DATABASE_URL = process.env.DATABASE_URL;
	if (!DATABASE_URL) {
		console.error('Error: DATABASE_URL is not set in your environment / .env file.');
		process.exit(1);
	}

	const confirm = process.argv.includes('--confirm');
	const days = parseDays();
	const cutoff = cutoffFromDays(days);
	try {
		console.log(`Connecting to Neon PostgreSQL…`);
		getNeonDatabase();
		console.log(`Connected. Cutoff: createdAt < ${cutoff.toISOString()} (${days} day(s)).`);
		console.log('Target table: auth.users only (never legacy users).');

		const db = getNeonDatabase();
		const verifiedBefore = (
			await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.emailVerified, true))
		).length;
		const candidates = await loadCandidates(cutoff);
		if (candidates.some((c) => c.emailVerified !== false)) {
			throw new Error('Safety abort: candidate list includes a non-unverified user');
		}

		if (candidates.length === 0) {
			console.log('No eligible unverified users.');
			return;
		}

		console.log(`\nEligible unverified users (${candidates.length}):`);
		for (const c of candidates) {
			console.log(
				`  - ${c.email}  id=${c.id}  createdAt=${c.createdAt.toISOString()}  emailVerified=${String(c.emailVerified)}`
			);
		}

		if (!confirm) {
			console.log('\nDry-run only. Re-run with --confirm to delete these users.');
			return;
		}

		console.log('\nDeleting…');
		let deletedCount = 0;
		for (const candidate of candidates) {
			if (await deleteOneUnverifiedUser(candidate, cutoff)) {
				deletedCount += 1;
				console.log(`  deleted ${candidate.email} (${candidate.id})`);
			}
		}

		const verifiedAfter = (
			await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.emailVerified, true))
		).length;
		if (verifiedAfter !== verifiedBefore) {
			throw new Error(
				`Safety abort: verified user count changed (${verifiedBefore} → ${verifiedAfter})`
			);
		}

		console.log(`\n✓ Deleted ${deletedCount} of ${candidates.length} candidate(s).`);
		console.log(`Verified users unchanged: ${verifiedAfter}`);
	} finally {
		// Neon HTTP has no client/socket to disconnect.
	}
}

const isDirectRun =
	typeof import.meta.main === 'boolean'
		? import.meta.main
		: process.argv[1]?.includes('cleanup-unverified-users.ts');

if (isDirectRun) {
	main().catch((err) => {
		console.error('Script failed:', err);
		process.exitCode = 1;
	});
}
