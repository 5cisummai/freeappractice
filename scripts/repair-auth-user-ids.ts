import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.DATABASE_URI;
if (!uri) throw new Error('DATABASE_URI is required');

const commit = process.argv.includes('--commit');

function getDbName(input: string): string {
	const url = new URL(input);
	const name = url.pathname.replace(/^\//, '');
	if (!name) throw new Error('DATABASE_URI must include a database name');
	return name;
}

const client = new MongoClient(uri);
const dbName = getDbName(uri);

async function main() {
	await client.connect();
	const db = client.db(dbName);
	const authUsers = db.collection('authUsers');
	const authSessions = db.collection('authSessions');
	const userProfiles = db.collection('userprofiles');

	const users = await authUsers.find({}).toArray();
	const mismatched = users.filter((user) => {
		if (typeof user.id !== 'string') return true;
		try {
			return user._id.toString() !== user.id;
		} catch {
			return true;
		}
	});

	const validUserIds = new Set(users.map((user) => user.id).filter((id): id is string => typeof id === 'string'));
	const orphanProfiles = (await userProfiles.find({}).toArray()).filter(
		(profile) => typeof profile.userId === 'string' && !validUserIds.has(profile.userId)
	);

	console.log({
		commit,
		authUsers: users.length,
		mismatchedAuthUsers: mismatched.length,
		sessions: await authSessions.countDocuments(),
		orphanProfiles: orphanProfiles.length
	});

	if (!commit) {
		if (mismatched.length) {
			console.log('\nSample mismatched auth users:');
			for (const user of mismatched.slice(0, 5)) {
				console.log({
					email: user.email,
					id: user.id,
					_id: user._id?.toString?.() ?? user._id
				});
			}
		}
		if (orphanProfiles.length) {
			console.log('\nOrphan profiles to delete:');
			for (const profile of orphanProfiles) {
				console.log({
					userId: profile.userId,
					history: profile.questionHistory?.length ?? 0
				});
			}
		}
		console.log('\nDry run only. Re-run with --commit to apply repairs.');
		return;
	}

	let repaired = 0;
	for (const user of mismatched) {
		if (typeof user.id !== 'string') {
			console.warn('Skipping auth user without string id:', user._id);
			continue;
		}

		const legacyObjectId = new ObjectId(user.id);
		const { _id: _ignored, ...rest } = user;
		await authUsers.deleteOne({ _id: user._id });
		await authUsers.insertOne({ _id: legacyObjectId, ...rest });
		repaired++;
	}

	const deletedSessions = await authSessions.deleteMany({});
	let deletedProfiles = 0;
	for (const profile of orphanProfiles) {
		await userProfiles.deleteOne({ _id: profile._id });
		deletedProfiles++;
	}

	console.log({
		repairedAuthUsers: repaired,
		deletedSessions: deletedSessions.deletedCount,
		deletedOrphanProfiles: deletedProfiles
	});
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await client.close();
	});
