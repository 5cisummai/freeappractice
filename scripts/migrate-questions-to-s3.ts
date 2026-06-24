/**
 * scripts/migrate-questions-to-s3.ts
 *
 * Backfills legacy Mongo cache docs (full inline bodies) to S3 and rewrites
 * user history/bookmark questionId values from Mongo _id to S3 UUID.
 *
 *   pnpm cache:migrate
 *   pnpm cache:migrate --dry-run
 *   pnpm cache:migrate --limit 100
 */

import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';

const DATABASE_URI = process.env.DATABASE_URI;
const isDryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Math.max(1, parseInt(limitArg.split('=')[1] ?? '0', 10) || 0) : 0;

if (!DATABASE_URI) {
	console.error('DATABASE_URI is required.');
	process.exit(1);
}

function computeContentHash(text: string): string {
	return createHash('sha256').update(text.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex');
}

function createS3Client(): S3Client {
	const region = process.env.AWS_REGION ?? 'us-east-1';
	const endpoint = process.env.AWS_S3_ENDPOINT;
	const forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE === 'true';
	const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
	const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
	const sessionToken = process.env.AWS_SESSION_TOKEN?.trim();

	const cfg: ConstructorParameters<typeof S3Client>[0] = { region };
	if (endpoint) {
		cfg.endpoint = endpoint;
		cfg.forcePathStyle = forcePathStyle;
	}
	if (accessKeyId && secretAccessKey) {
		cfg.credentials = {
			accessKeyId,
			secretAccessKey,
			...(sessionToken ? { sessionToken } : {})
		};
	}
	return new S3Client(cfg);
}

const s3 = createS3Client();
const bucket = process.env.AWS_S3_BUCKET ?? '';

async function putQuestionToS3(payload: Record<string, unknown>): Promise<string> {
	if (!bucket.trim()) throw new Error('AWS_S3_BUCKET is not configured');
	const questionId = randomUUID();
	const key = `questions/${questionId}.json`;
	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: JSON.stringify({ id: questionId, ...payload, createdAt: new Date().toISOString() }),
			ContentType: 'application/json'
		})
	);
	return questionId;
}

const questionSchema = new mongoose.Schema(
	{
		apClass: String,
		unit: String,
		s3QuestionId: String,
		contentHash: String,
		topicsCovered: String,
		question: String,
		optionA: String,
		optionB: String,
		optionC: String,
		optionD: String,
		correctAnswer: String,
		explanation: String,
		status: String
	},
	{ timestamps: true }
);

const userProfileSchema = new mongoose.Schema({
	userId: String,
	questionHistory: [{ questionId: String }],
	bookmarkedQuestions: [String]
});

const recentTopicSchema = new mongoose.Schema(
	{ apClass: String, unit: String, topicsCovered: String, s3QuestionId: String },
	{ timestamps: { createdAt: true, updatedAt: false } }
);

const Question = mongoose.models.Question ?? mongoose.model('Question', questionSchema);
const UserProfile = mongoose.models.UserProfile ?? mongoose.model('UserProfile', userProfileSchema);
const QuestionRecentTopic =
	mongoose.models.QuestionRecentTopic ?? mongoose.model('QuestionRecentTopic', recentTopicSchema);

const LEGACY_BODY_FIELDS = [
	'question',
	'optionA',
	'optionB',
	'optionC',
	'optionD',
	'correctAnswer',
	'explanation'
] as const;

async function buildExistingMappings(): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	const docs = await Question.find(
		{ s3QuestionId: { $exists: true, $nin: [null, ''] } },
		{ _id: 1, s3QuestionId: 1 }
	).lean();

	for (const doc of docs) {
		const mongoId = doc._id.toString();
		const s3QuestionId = doc.s3QuestionId as string;
		if (s3QuestionId) {
			map.set(mongoId, s3QuestionId);
		}
	}

	console.log(`Existing pool id mappings (already migrated): ${map.size}`);
	return map;
}

async function migratePoolDocs(mongoToS3: Map<string, string>): Promise<void> {
	const query = {
		$or: [{ s3QuestionId: { $exists: false } }, { s3QuestionId: null }, { s3QuestionId: '' }],
		question: { $exists: true, $ne: '' }
	};

	const total = await Question.countDocuments(query);
	console.log(`Legacy pool docs to migrate: ${total}`);

	let cursor = Question.find(query).sort({ createdAt: 1 });
	if (limit > 0) cursor = cursor.limit(limit);
	const docs = await cursor.lean();

	for (const doc of docs) {
		const mongoId = doc._id.toString();
		if (!doc.question || !doc.optionA || !doc.optionB || !doc.optionC || !doc.optionD) {
			console.warn(`  skip ${mongoId}: incomplete legacy body`);
			continue;
		}

		const contentHash =
			doc.contentHash ?? computeContentHash(doc.question as string);
		const payload = {
			question: doc.question,
			optionA: doc.optionA,
			optionB: doc.optionB,
			optionC: doc.optionC,
			optionD: doc.optionD,
			correctAnswer: doc.correctAnswer,
			explanation: doc.explanation,
			apClass: doc.apClass,
			unit: doc.unit,
			contentHash,
			topicsCovered: doc.topicsCovered ?? ''
		};

		if (isDryRun) {
			console.log(`  [dry-run] would migrate pool doc ${mongoId}`);
			mongoToS3.set(mongoId, `dry-run-${mongoId}`);
			continue;
		}

		const s3QuestionId = await putQuestionToS3(payload);
		const unsetFields = Object.fromEntries(LEGACY_BODY_FIELDS.map((field) => [field, '']));
		await Question.updateOne(
			{ _id: doc._id },
			{
				$set: { s3QuestionId, contentHash },
				$unset: unsetFields
			}
		);

		if (doc.topicsCovered) {
			await QuestionRecentTopic.updateOne(
				{ apClass: doc.apClass, unit: doc.unit, topicsCovered: doc.topicsCovered, s3QuestionId },
				{
					$setOnInsert: {
						apClass: doc.apClass,
						unit: doc.unit,
						topicsCovered: doc.topicsCovered,
						s3QuestionId
					}
				},
				{ upsert: true }
			);
		}

		mongoToS3.set(mongoId, s3QuestionId);
		console.log(`  migrated pool doc ${mongoId} -> ${s3QuestionId}`);
	}
}

function isMongoObjectId(id: string): boolean {
	return /^[0-9a-f]{24}$/i.test(id);
}

async function migrateUserReferences(mongoToS3: Map<string, string>): Promise<void> {
	if (mongoToS3.size === 0) {
		console.log('No pool id mappings — skipping user reference migration.');
		return;
	}

	const mongoIds = [...mongoToS3.keys()];

	const users = await UserProfile.find({
		$or: [
			{ 'questionHistory.questionId': { $in: mongoIds } },
			{ bookmarkedQuestions: { $in: mongoIds } }
		]
	}).lean();

	console.log(`User profiles to update: ${users.length}`);

	for (const user of users) {
		let historyUpdates = 0;
		let bookmarkUpdates = 0;

		const nextHistory = (user.questionHistory ?? []).map(
			(entry: { questionId: string; [key: string]: unknown }) => {
				if (!isMongoObjectId(entry.questionId)) return entry;
				const mapped = mongoToS3.get(entry.questionId);
				if (!mapped) return entry;
				historyUpdates++;
				return { ...entry, questionId: mapped };
			}
		);

		const nextBookmarks = (user.bookmarkedQuestions ?? []).map((id: string) => {
			if (!isMongoObjectId(id)) return id;
			const mapped = mongoToS3.get(id);
			if (!mapped) return id;
			bookmarkUpdates++;
			return mapped;
		});

		if (historyUpdates === 0 && bookmarkUpdates === 0) continue;

		if (isDryRun) {
			console.log(
				`  [dry-run] user ${user.userId}: ${historyUpdates} history, ${bookmarkUpdates} bookmarks`
			);
			continue;
		}

		await UserProfile.updateOne(
			{ _id: user._id },
			{ $set: { questionHistory: nextHistory, bookmarkedQuestions: nextBookmarks } }
		);
		console.log(
			`  updated user ${user.userId}: ${historyUpdates} history, ${bookmarkUpdates} bookmarks`
		);
	}
}

async function main() {
	console.log(`Connecting to MongoDB…${isDryRun ? ' (dry-run)' : ''}`);
	await mongoose.connect(DATABASE_URI!, { serverSelectionTimeoutMS: 10_000 });

	const mongoToS3 = await buildExistingMappings();
	await migratePoolDocs(mongoToS3);
	await migrateUserReferences(mongoToS3);

	console.log('Migration complete.');
}

main()
	.catch((err) => {
		console.error('Migration failed:', err);
		process.exitCode = 1;
	})
	.finally(() => mongoose.disconnect());
