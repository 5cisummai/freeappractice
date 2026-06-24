/**
 * scripts/cleanup-retired-cache.ts
 *
 * Deletes legacy retired pool docs and any pool docs missing s3QuestionId with no legacy body.
 *
 *   pnpm cache:cleanup
 *   pnpm cache:cleanup --dry-run
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const DATABASE_URI = process.env.DATABASE_URI;
const isDryRun = process.argv.includes('--dry-run');

if (!DATABASE_URI) {
	console.error('DATABASE_URI is required.');
	process.exit(1);
}

const questionSchema = new mongoose.Schema(
	{
		s3QuestionId: String,
		question: String,
		status: String
	},
	{ timestamps: true }
);

const Question = mongoose.models.Question ?? mongoose.model('Question', questionSchema);

async function main() {
	await mongoose.connect(DATABASE_URI!, { serverSelectionTimeoutMS: 10_000 });

	const retiredCount = await Question.countDocuments({ status: 'retired' });
	const orphanCount = await Question.countDocuments({
		$and: [
			{ $or: [{ s3QuestionId: { $exists: false } }, { s3QuestionId: null }, { s3QuestionId: '' }] },
			{ $or: [{ question: { $exists: false } }, { question: null }, { question: '' }] }
		]
	});

	console.log(`Retired pool docs: ${retiredCount}`);
	console.log(`Orphan pool docs (no s3QuestionId and no legacy body): ${orphanCount}`);

	if (isDryRun) {
		console.log('Dry-run mode — nothing deleted.');
		return;
	}

	const [retiredResult, orphanResult] = await Promise.all([
		Question.deleteMany({ status: 'retired' }),
		Question.deleteMany({
			$and: [
				{
					$or: [{ s3QuestionId: { $exists: false } }, { s3QuestionId: null }, { s3QuestionId: '' }]
				},
				{ $or: [{ question: { $exists: false } }, { question: null }, { question: '' }] }
			]
		})
	]);

	console.log(`Deleted ${retiredResult.deletedCount} retired doc(s).`);
	console.log(`Deleted ${orphanResult.deletedCount} orphan doc(s).`);
}

main()
	.catch((err) => {
		console.error('Cleanup failed:', err);
		process.exitCode = 1;
	})
	.finally(() => mongoose.disconnect());
