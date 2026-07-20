/**
 * scripts/migrate-question-pool-schema.ts
 *
 * Idempotent migration: assign randomKey/active on existing MCQ + FRQ pool rows,
 * ensure compound selection indexes, and verify them.
 *
 *   bun run pool:migrate-schema
 *   bun run pool:migrate-schema --dry-run
 */

import 'dotenv/config';
import { MongoClient, type Db } from 'mongodb';

const DATABASE_URI = process.env.DATABASE_URI;
const isDryRun = process.argv.includes('--dry-run');

if (!DATABASE_URI) {
	console.error('Error: DATABASE_URI is not set.');
	process.exit(1);
}

function getDbName(input: string): string {
	const url = new URL(input);
	const name = url.pathname.replace(/^\//, '');
	if (!name) throw new Error('DATABASE_URI must include a database name');
	return name;
}

const SELECTION_INDEX = {
	key: { apClass: 1, unit: 1, active: 1, randomKey: 1 },
	name: 'apClass_1_unit_1_active_1_randomKey_1'
} as const;

async function backfillCollection(db: Db, collectionName: string): Promise<{
	missingRandomKey: number;
	missingActive: number;
	updated: number;
}> {
	const col = db.collection(collectionName);
	const missingRandomKey = await col.countDocuments({
		$or: [{ randomKey: { $exists: false } }, { randomKey: null }]
	});
	const missingActive = await col.countDocuments({
		$or: [{ active: { $exists: false } }, { active: null }]
	});

	if (isDryRun) {
		return { missingRandomKey, missingActive, updated: 0 };
	}

	let updated = 0;
	const cursor = col.find({
		$or: [
			{ randomKey: { $exists: false } },
			{ randomKey: null },
			{ active: { $exists: false } },
			{ active: null }
		]
	});

	for await (const doc of cursor) {
		const set: Record<string, unknown> = {};
		if (typeof doc.randomKey !== 'number') set.randomKey = Math.random();
		if (typeof doc.active !== 'boolean') set.active = true;
		if (Object.keys(set).length === 0) continue;
		await col.updateOne({ _id: doc._id }, { $set: set });
		updated += 1;
	}

	return { missingRandomKey, missingActive, updated };
}

async function ensureSelectionIndex(db: Db, collectionName: string): Promise<void> {
	const col = db.collection(collectionName);
	if (isDryRun) {
		const indexes = await col.indexes();
		const exists = indexes.some((idx) => idx.name === SELECTION_INDEX.name);
		console.log(
			`  [${collectionName}] selection index ${SELECTION_INDEX.name}: ${exists ? 'present' : 'MISSING (would create)'}`
		);
		return;
	}

	await col.createIndex(SELECTION_INDEX.key, { name: SELECTION_INDEX.name });
	const indexes = await col.indexes();
	const created = indexes.find((idx) => idx.name === SELECTION_INDEX.name);
	if (!created) {
		throw new Error(`Failed to verify index ${SELECTION_INDEX.name} on ${collectionName}`);
	}
	console.log(`  [${collectionName}] verified index ${SELECTION_INDEX.name}`);
}

async function main() {
	const client = new MongoClient(DATABASE_URI!);
	await client.connect();
	const db = client.db(getDbName(DATABASE_URI!));
	console.log(isDryRun ? 'Dry-run migration…' : 'Running migration…');

	for (const name of ['questions', 'frqquestions']) {
		console.log(`\nCollection: ${name}`);
		const result = await backfillCollection(db, name);
		console.log(
			`  missing randomKey=${result.missingRandomKey}, missing active=${result.missingActive}, updated=${result.updated}`
		);
		await ensureSelectionIndex(db, name);
	}

	await client.close();
	console.log('\nDone.');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
