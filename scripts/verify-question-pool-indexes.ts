/**
 * scripts/verify-question-pool-indexes.ts
 *
 * Explain-based verification that MCQ/FRQ pool selection uses the compound
 * index { apClass, unit, active, randomKey } and does not COLLSCAN.
 *
 *   bun run pool:verify-indexes
 *
 * Exits non-zero if the index is missing or Mongo would collection-scan.
 * Uses a fixed catalog class/unit so explain filters are never CLI-tainted.
 */

import 'dotenv/config';
import { MongoClient, type Collection, type Document } from 'mongodb';
import {
	POOL_SELECTION_INDEX_NAME,
	planUsesCollectionScan,
	planUsesIndexScan,
	poolSelectionFilter,
	type ExplainPlanNode
} from '../src/lib/questions/pool-index-explain';
import { loadCombos, type ClassUnitCombo } from './shared';

const DATABASE_URI = process.env.DATABASE_URI;

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

/** First catalog combo — labels come only from committed ap-classes.json. */
function catalogExplainBucket(): ClassUnitCombo {
	const { combos } = loadCombos();
	const first = combos[0];
	if (!first) {
		throw new Error('AP catalog has no class/unit combos to explain against.');
	}
	return first;
}

async function assertSelectionIndex(col: Collection<Document>, collectionName: string): Promise<void> {
	const indexes = await col.indexes();
	const found = indexes.find((idx) => idx.name === POOL_SELECTION_INDEX_NAME);
	if (!found) {
		throw new Error(
			`[${collectionName}] missing selection index ${POOL_SELECTION_INDEX_NAME}. Run bun run pool:migrate-schema first.`
		);
	}
	console.log(`  [${collectionName}] index ${POOL_SELECTION_INDEX_NAME}: present`);
}

async function explainSelection(
	col: Collection<Document>,
	collectionName: string,
	bucket: ClassUnitCombo
): Promise<void> {
	const filter = poolSelectionFilter({
		apClass: bucket.className,
		unit: bucket.unit,
		pivot: 0.5
	});
	const explain = (await col
		.find(filter)
		.sort({ randomKey: 1 })
		.limit(1)
		.explain('queryPlanner')) as ExplainPlanNode;

	if (planUsesCollectionScan(explain)) {
		throw new Error(
			`[${collectionName}] selection query would COLLSCAN for apClass=${bucket.className} unit=${bucket.unit}. Check compound index and query shape.`
		);
	}
	if (!planUsesIndexScan(explain)) {
		throw new Error(
			`[${collectionName}] selection query did not use IXSCAN for apClass=${bucket.className} unit=${bucket.unit}.`
		);
	}
	console.log(
		`  [${collectionName}] explain OK (IXSCAN, no COLLSCAN) for apClass=${JSON.stringify(bucket.className)} unit=${JSON.stringify(bucket.unit)}`
	);
}

async function verifyCollection(
	col: Collection<Document>,
	collectionName: string,
	bucket: ClassUnitCombo
): Promise<void> {
	console.log(`\nCollection: ${collectionName}`);
	await assertSelectionIndex(col, collectionName);
	await explainSelection(col, collectionName, bucket);
}

async function main() {
	const bucket = catalogExplainBucket();
	const client = new MongoClient(DATABASE_URI!);
	await client.connect();
	const db = client.db(getDbName(DATABASE_URI!));

	console.log('Verifying question pool selection indexes…');
	console.log(`  Using catalog bucket: ${bucket.className} / ${bucket.unit}`);
	try {
		await verifyCollection(db.collection('questions'), 'questions', bucket);
		await verifyCollection(db.collection('frqquestions'), 'frqquestions', bucket);
		console.log('\nAll pool selection indexes verified.');
	} finally {
		await client.close();
	}
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
