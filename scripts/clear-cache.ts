/**
 * scripts/clear-cache.ts
 *
 * Drops every pre-generated question from the cache pool.
 *
 *   pnpm cache:clear
 *
 * Add --dry-run to print the count without deleting.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

// ── Bootstrap ───────────────────────────────────────────────
const DATABASE_URI = process.env.DATABASE_URI;
if (!DATABASE_URI) {
	console.error('Error: DATABASE_URI is not set in your environment / .env file.');
	process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');

// ── Minimal inline schema (mirrors src/lib/server/models/question.ts) ─
const questionSchema = new mongoose.Schema(
	{
		apClass: String,
		unit: String,
		question: String,
		optionA: String,
		optionB: String,
		optionC: String,
		optionD: String,
		correctAnswer: String,
		explanation: String,
		lastServedAt: Date,
		status: String,
		serveCount: Number,
		maxServeCount: Number,
		lockedUntil: Date
	},
	{ timestamps: true }
);

const Question =
	(mongoose.models['Question'] as mongoose.Model<mongoose.Document>) ??
	mongoose.model('Question', questionSchema);

// ── Main ───────────────────────────────────────────────────
async function main() {
	console.log(`Connecting to MongoDB…`);
	await mongoose.connect(DATABASE_URI!, { serverSelectionTimeoutMS: 10_000 });
	console.log('Connected.');

	const [total, available, serving, retired] = await Promise.all([
		Question.countDocuments({}),
		Question.countDocuments({ status: 'available' }),
		Question.countDocuments({ status: 'serving' }),
		Question.countDocuments({ status: 'retired' })
	]);
	console.log(
		`Cache contains ${total} question(s): ${available} available, ${serving} serving, ${retired} retired.`
	);

	if (isDryRun) {
		console.log('Dry-run mode — nothing deleted.');
	} else {
		const result = await Question.deleteMany({});
		console.log(`✓ Deleted ${result.deletedCount} question(s) from the MCQ cache.`);

		// Also clear FRQ cache
		const frqSchema = new mongoose.Schema({ apClass: String, unit: String });
		const FRQQuestion =
			(mongoose.models['FRQQuestion'] as mongoose.Model<mongoose.Document>) ??
			mongoose.model('FRQQuestion', frqSchema);
		const frqResult = await FRQQuestion.deleteMany({});
		console.log(`✓ Deleted ${frqResult.deletedCount} question(s) from the FRQ cache.`);

		// Also clear SeenQuestion history
		const seenSchema = new mongoose.Schema({ userId: String });
		const SeenQuestion =
			(mongoose.models['SeenQuestion'] as mongoose.Model<mongoose.Document>) ??
			mongoose.model('SeenQuestion', seenSchema);
		const seenResult = await SeenQuestion.deleteMany({});
		console.log(`✓ Deleted ${seenResult.deletedCount} history records from SeenQuestion.`);
	}
}

main()
	.catch((err) => {
		console.error('Script failed:', err);
		process.exitCode = 1;
	})
	.finally(() => mongoose.disconnect());
