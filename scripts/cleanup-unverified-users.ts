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
import { MongoClient, ObjectId, type Db } from 'mongodb';
import mongoose from 'mongoose';
import { deleteAppDataDocuments } from '../src/lib/users/delete-app-data-documents.server.ts';
import {
	assertSafeEmail,
	assertSafeUserId,
	isEligibleUnverifiedUser,
	unverifiedStaleFilter,
	type CleanupCandidate
} from './cleanup-unverified-users-lib';

export {
	assertSafeEmail,
	assertSafeUserId,
	isEligibleUnverifiedUser,
	unverifiedStaleFilter
} from './cleanup-unverified-users-lib';

const DEFAULT_MAX_AGE_DAYS = 1;

type AuthUserDoc = {
	_id: string;
	email?: string;
	emailVerified?: boolean | null;
	createdAt?: Date;
};

function getArg(flag: string): string | undefined {
	const idx = process.argv.indexOf(flag);
	return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined;
}

function getDbName(uri: string): string {
	const name = new URL(uri).pathname.replace(/^\//, '');
	if (!name) throw new Error('DATABASE_URI must include a database name');
	return name;
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

async function loadCandidates(db: Db, cutoff: Date): Promise<CleanupCandidate[]> {
	const docs = await db
		.collection<AuthUserDoc>('authUsers')
		.find(unverifiedStaleFilter(cutoff))
		.project({ _id: 1, email: 1, emailVerified: 1, createdAt: 1 })
		.toArray();

	const candidates: CleanupCandidate[] = [];
	for (const doc of docs) {
		if (doc.emailVerified !== false) {
			throw new Error(
				`Safety abort: non-unverified user ${String(doc._id)} appeared in candidate set`
			);
		}
		if (!isEligibleUnverifiedUser(doc, cutoff)) {
			throw new Error(
				`Safety abort: query returned ineligible user ${String(doc._id)} (emailVerified=${String(doc.emailVerified)})`
			);
		}
		if (!(doc.createdAt instanceof Date)) {
			throw new Error(`Safety abort: candidate ${String(doc._id)} missing createdAt`);
		}
		candidates.push({
			id: assertSafeUserId(String(doc._id)),
			email: assertSafeEmail(doc.email),
			emailVerified: doc.emailVerified,
			createdAt: doc.createdAt
		});
	}
	return candidates;
}

async function deleteOneUnverifiedUser(db: Db, candidate: CleanupCandidate, cutoff: Date) {
	const authUsers = db.collection<AuthUserDoc>('authUsers');
	const userId = assertSafeUserId(candidate.id);
	const email = assertSafeEmail(candidate.email);
	if (!ObjectId.isValid(userId)) {
		throw new Error(`Safety abort: user id is not a valid ObjectId: ${userId}`);
	}
	const objectId = new ObjectId(userId);

	// Atomic: only deletes if still unverified, same email, and still older than cutoff.
	// authUsers._id is BSON ObjectId; related rows store userId as string.
	const deleted = await authUsers.findOneAndDelete({
		_id: objectId as unknown as string,
		email,
		emailVerified: false,
		createdAt: { $lt: cutoff }
	});

	if (!deleted) {
		console.log(`  skipped ${email} (${userId}) — no longer eligible`);
		return false;
	}

	if (deleted.emailVerified !== false) {
		throw new Error(`Safety abort: refuse to cascade-delete non-unverified user ${userId}`);
	}

	const deletedId = assertSafeUserId(String(deleted._id));
	const deletedEmail = assertSafeEmail(deleted.email ?? email);

	await Promise.all([
		db.collection('authSessions').deleteMany({ userId: deletedId }),
		db.collection('authAccounts').deleteMany({ userId: deletedId }),
		db.collection('authVerifications').deleteMany({
			$or: [{ identifier: deletedEmail }, { identifier: deletedEmail.toLowerCase() }]
		})
	]);
	await deleteAppDataDocuments([deletedId]);

	return true;
}

async function main() {
	const DATABASE_URI = process.env.DATABASE_URI;
	if (!DATABASE_URI) {
		console.error('Error: DATABASE_URI is not set in your environment / .env file.');
		process.exit(1);
	}

	const confirm = process.argv.includes('--confirm');
	const days = parseDays();
	const cutoff = cutoffFromDays(days);
	const client = new MongoClient(DATABASE_URI);

	try {
		console.log(`Connecting to MongoDB…`);
		await client.connect();
		const db = client.db(getDbName(DATABASE_URI));
		console.log(`Connected. Cutoff: createdAt < ${cutoff.toISOString()} (${days} day(s)).`);
		console.log('Target collection: authUsers only (never legacy users).');

		const verifiedBefore = await db.collection('authUsers').countDocuments({ emailVerified: true });
		const candidates = await loadCandidates(db, cutoff);
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

		await mongoose.connect(DATABASE_URI);
		console.log('\nDeleting…');
		let deletedCount = 0;
		for (const candidate of candidates) {
			if (await deleteOneUnverifiedUser(db, candidate, cutoff)) {
				deletedCount += 1;
				console.log(`  deleted ${candidate.email} (${candidate.id})`);
			}
		}

		const verifiedAfter = await db.collection('authUsers').countDocuments({ emailVerified: true });
		if (verifiedAfter !== verifiedBefore) {
			throw new Error(
				`Safety abort: verified user count changed (${verifiedBefore} → ${verifiedAfter})`
			);
		}

		console.log(`\n✓ Deleted ${deletedCount} of ${candidates.length} candidate(s).`);
		console.log(`Verified users unchanged: ${verifiedAfter}`);
	} finally {
		if (mongoose.connection.readyState !== 0) {
			await mongoose.disconnect();
		}
		await client.close();
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
