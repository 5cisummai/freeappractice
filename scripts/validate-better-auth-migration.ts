import 'dotenv/config';
import mongoose from 'mongoose';
import { MongoClient, ObjectId } from 'mongodb';
import { LegacyUser } from './models/user-legacy';
import { UserProfile } from '../src/lib/users/model.server';

const uri = process.env.DATABASE_URI;
if (!uri) throw new Error('DATABASE_URI is required');

function getDbName(input: string): string {
	const url = new URL(input);
	const name = url.pathname.replace(/^\//, '');
	if (!name) throw new Error('DATABASE_URI must include a database name');
	return name;
}

const client = new MongoClient(uri);
const dbName = getDbName(uri);

async function main() {
	await mongoose.connect(uri);
	await client.connect();
	const db = client.db(dbName);

	const authUsers = db.collection('authUsers');
	const authAccounts = db.collection('authAccounts');
	const seenQuestions = db.collection('seenquestions');

	const sourceUsers = await LegacyUser.find({}).lean();
	const authUserCount = await authUsers.countDocuments();
	const profileCount = await UserProfile.countDocuments();

	const problems: string[] = [];
	if (authUserCount < sourceUsers.length) {
		problems.push(
			`authUsers count ${authUserCount} is less than source users ${sourceUsers.length}`
		);
	}
	if (profileCount < sourceUsers.length) {
		problems.push(
			`UserProfile count ${profileCount} is less than source users ${sourceUsers.length}`
		);
	}

	for (const sourceUser of sourceUsers) {
		const userId = sourceUser._id.toString();
		const authUser = await authUsers.findOne({ id: userId });
		const profile = await UserProfile.findOne({ userId }).lean();

		if (!authUser) {
			problems.push(`Missing auth user for ${userId}`);
			continue;
		}
		try {
			if (authUser._id.toString() !== userId) {
				problems.push(`authUsers _id/id mismatch for ${userId}`);
			}
		} catch {
			problems.push(`authUsers invalid _id for ${userId}`);
		}
		const authByCanonicalId = await authUsers.findOne({ _id: new ObjectId(userId) });
		if (!authByCanonicalId) {
			problems.push(`Missing auth user at _id ${userId}`);
		}
		if (!profile) {
			problems.push(`Missing profile for ${userId}`);
			continue;
		}
		if ((profile.questionHistory?.length ?? 0) !== (sourceUser.questionHistory?.length ?? 0)) {
			problems.push(`Question history length mismatch for ${userId}`);
		}
		if (
			(profile.bookmarkedQuestions?.length ?? 0) !== (sourceUser.bookmarkedQuestions?.length ?? 0)
		) {
			problems.push(`Bookmark count mismatch for ${userId}`);
		}
		if (sourceUser.password) {
			const credential = await authAccounts.findOne({ userId, providerId: 'credential' });
			if (!credential) problems.push(`Missing credential account for ${userId}`);
		}
		if (sourceUser.googleId) {
			const google = await authAccounts.findOne({ userId, providerId: 'google' });
			if (!google) problems.push(`Missing google account for ${userId}`);
		}
	}

	const seenUserIds = await seenQuestions.distinct('userId');
	const authUserIds = new Set(
		(await authUsers.find({}, { projection: { id: 1 } }).toArray()).map((u) => u.id)
	);
	for (const seenUserId of seenUserIds) {
		if (!authUserIds.has(seenUserId)) {
			problems.push(`seenquestions references unknown userId ${seenUserId}`);
		}
	}

	const credentialCount = await authAccounts.countDocuments({ providerId: 'credential' });
	const googleCount = await authAccounts.countDocuments({ providerId: 'google' });
	const bothCount = await authAccounts
		.aggregate([
			{ $group: { _id: '$userId', providers: { $addToSet: '$providerId' } } },
			{ $match: { providers: { $all: ['credential', 'google'] } } },
			{ $count: 'count' }
		])
		.toArray();
	const unverifiedCount = await authUsers.countDocuments({ emailVerified: false });

	console.log({
		sourceUsers: sourceUsers.length,
		authUsers: authUserCount,
		profiles: profileCount,
		credentialAccounts: credentialCount,
		googleAccounts: googleCount,
		bothProviders: bothCount[0]?.count ?? 0,
		unverifiedAuthUsers: unverifiedCount,
		seenQuestionUserIds: seenUserIds.length
	});

	if (problems.length) {
		console.error('Validation failed:');
		for (const problem of problems) console.error('-', problem);
		process.exitCode = 1;
		return;
	}

	console.log('Validation passed.');
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await mongoose.disconnect();
		await client.close();
	});
