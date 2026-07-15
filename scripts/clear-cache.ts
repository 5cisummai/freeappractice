/**
 * scripts/clear-cache.ts
 *
 * Drops every pre-generated question from the Mongo cache pool.
 * S3 objects are untouched — history and bookmarks keep working.
 *
 *   bun run cache:clear
 *   bun run cache:clear --dry-run
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const DATABASE_URI = process.env.DATABASE_URI;
if (!DATABASE_URI) {
	console.error('Error: DATABASE_URI is not set in your environment / .env file.');
	process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');

const questionSchema = new mongoose.Schema(
	{
		apClass: String,
		unit: String,
		s3QuestionId: String
	},
	{ timestamps: true }
);

const Question =
	(mongoose.models['Question'] as mongoose.Model<mongoose.Document>) ??
	mongoose.model('Question', questionSchema);

async function main() {
	console.log(`Connecting to MongoDB…`);
	await mongoose.connect(DATABASE_URI!, { serverSelectionTimeoutMS: 10_000 });
	console.log('Connected.');

	const total = await Question.countDocuments({});
	console.log(`Cache contains ${total} reusable question(s).`);
	console.log('S3 question objects are not modified by this script.');

	if (isDryRun) {
		console.log('Dry-run mode — nothing deleted.');
		return;
	}

	const result = await Question.deleteMany({});
	console.log(`✓ Deleted ${result.deletedCount} question(s) from the Mongo cache pool.`);
}

main()
	.catch((err) => {
		console.error('Script failed:', err);
		process.exitCode = 1;
	})
	.finally(() => mongoose.disconnect());
