import 'dotenv/config';
import mongoose from 'mongoose';
import { MongoClient, ObjectId } from 'mongodb';
import { User } from '../src/lib/server/models/user';
import { UserProfile } from '../src/lib/server/models/user-profile';

const uri = process.env.DATABASE_URI;
if (!uri) throw new Error('DATABASE_URI is required');

const commit = process.argv.includes('--commit');
const resume = process.argv.includes('--resume');
const verifyOnly = process.argv.includes('--verify-only');
const limitArgIndex = process.argv.indexOf('--limit');
const limit = limitArgIndex !== -1 ? Number(process.argv[limitArgIndex + 1]) : undefined;

function getDbName(input: string): string {
	const url = new URL(input);
	const name = url.pathname.replace(/^\//, '');
	if (!name) throw new Error('DATABASE_URI must include a database name');
	return name;
}

const client = new MongoClient(uri);
const dbName = getDbName(uri);

async function main() {
	if (verifyOnly) {
		const { execFileSync } = await import('node:child_process');
		const { fileURLToPath } = await import('node:url');
		const validateScript = fileURLToPath(
			new URL('./validate-better-auth-migration.ts', import.meta.url)
		);
		execFileSync(process.execPath, ['--import', 'tsx', validateScript], { stdio: 'inherit' });
		return;
	}

	await mongoose.connect(uri);
	await client.connect();

	const db = client.db(dbName);
	const authUsers = db.collection('authUsers');
	const authAccounts = db.collection('authAccounts');
	const migrationMap = db.collection('betterAuthMigrationMap');

	const users = await User.find({}).sort({ createdAt: 1 }).lean();
	const selected = typeof limit === 'number' ? users.slice(0, limit) : users;

	let migrated = 0;
	let skipped = 0;

	for (const legacyUser of selected) {
		const legacyUserId = legacyUser._id.toString();
		const betterAuthUserId = legacyUserId;
		const email = legacyUser.email.toLowerCase().trim();

		if (resume) {
			const existing = await migrationMap.findOne({ legacyUserId });
			if (existing?.status === 'completed') {
				skipped++;
				continue;
			}
		}

		const authUserDoc = {
			id: betterAuthUserId,
			name: legacyUser.name,
			email,
			emailVerified: legacyUser.verified,
			image: null,
			createdAt: legacyUser.createdAt,
			updatedAt: legacyUser.updatedAt
		};

		const accountDocs = [] as Array<Record<string, unknown>>;
		if (legacyUser.password) {
			accountDocs.push({
				id: `credential:${betterAuthUserId}`,
				userId: betterAuthUserId,
				accountId: betterAuthUserId,
				providerId: 'credential',
				password: legacyUser.password,
				createdAt: legacyUser.createdAt,
				updatedAt: legacyUser.updatedAt
			});
		}
		if (legacyUser.googleId) {
			accountDocs.push({
				id: `google:${betterAuthUserId}`,
				userId: betterAuthUserId,
				accountId: legacyUser.googleId,
				providerId: 'google',
				createdAt: legacyUser.createdAt,
				updatedAt: legacyUser.updatedAt
			});
		}

		const profileDoc = {
			userId: betterAuthUserId,
			legacyUserId,
			progress: legacyUser.progress ?? [],
			questionHistory: legacyUser.questionHistory ?? [],
			frqHistory: legacyUser.frqHistory ?? [],
			bookmarkedQuestions: legacyUser.bookmarkedQuestions ?? []
		};

		if (!commit) {
			console.log('[dry-run]', {
				legacyUserId,
				betterAuthUserId,
				email,
				accounts: accountDocs.map((doc) => ({ id: doc.id, providerId: doc.providerId }))
			});
			migrated++;
			continue;
		}

		// Better Auth's Mongo adapter treats `_id` as the canonical user id in sessions.
		// Legacy Mongo user ids must be the document `_id`, not only the `id` field.
		await authUsers.updateOne(
			{ _id: new ObjectId(betterAuthUserId) },
			{ $set: authUserDoc },
			{ upsert: true }
		);

		for (const accountDoc of accountDocs) {
			await authAccounts.updateOne(
				{ id: accountDoc.id },
				{ $set: accountDoc },
				{ upsert: true }
			);
		}

		await UserProfile.updateOne({ userId: betterAuthUserId }, { $set: profileDoc }, { upsert: true });

		await migrationMap.updateOne(
			{ legacyUserId },
			{
				$set: {
					betterAuthUserId,
					email,
					hasCredential: Boolean(legacyUser.password),
					hasGoogle: Boolean(legacyUser.googleId),
					status: 'completed',
					migratedAt: new Date()
				}
			},
			{ upsert: true }
		);

		migrated++;
	}

	console.log({ commit, resume, totalSource: users.length, selected: selected.length, migrated, skipped });
}

main()
	.catch(async (error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await mongoose.disconnect();
		await client.close();
	});
