/**
 * Copy the serving pools into isolated v2 collections and verify an exact copy.
 * This script never deletes, renames, or mutates the source collections.
 *
 * Local rehearsal (same database, different collections):
 *   bun run pool:migrate-v2 -- --local-target
 *   bun run pool:migrate-v2 -- --local-target --prepare --confirm=PREPARE-POOL-V2
 *   bun run pool:migrate-v2 -- --local-target --verify
 *
 * Production staging (credentials stay in environment variables):
 *   TARGET_DATABASE_URI=... bun run pool:migrate-v2
 *   TARGET_DATABASE_URI=... bun run pool:migrate-v2 -- --prepare --confirm=PREPARE-POOL-V2
 *   TARGET_DATABASE_URI=... bun run pool:migrate-v2 -- --verify
 *
 * After verification, configure the app with:
 *   QUESTION_POOL_MCQ_COLLECTION=questions_pool_v2
 *   QUESTION_POOL_FRQ_COLLECTION=frqquestions_pool_v2
 */

import 'dotenv/config';
import { createHash } from 'node:crypto';
import {
	MongoClient,
	type Collection,
	type Db,
	type Document,
	type IndexDescription
} from 'mongodb';

const sourceUri = process.env.SOURCE_DATABASE_URI ?? process.env.DATABASE_URI;
const localTarget = process.argv.includes('--local-target');
const targetUri =
	process.env.TARGET_DATABASE_URI ??
	process.env.PRODUCTION_DATABASE_URI ??
	(localTarget ? sourceUri : '');
const prepare = process.argv.includes('--prepare');
const verifyOnly = process.argv.includes('--verify');
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm='))?.slice(10);
const batchSize = 500;
const activeFilter = { active: { $ne: false } } as const;

const collectionPairs = [
	{
		type: 'mcq',
		source: process.env.SOURCE_MCQ_POOL_COLLECTION ?? 'questions',
		target: process.env.TARGET_MCQ_POOL_COLLECTION ?? 'questions_pool_v2',
		required: [
			'apClass',
			'unit',
			'contentHash',
			's3QuestionId',
			'question',
			'optionA',
			'optionB',
			'optionC',
			'optionD',
			'correctAnswer',
			'explanation',
			'randomKey',
			'active'
		],
		requiredStrings: [
			'apClass',
			'unit',
			'contentHash',
			's3QuestionId',
			'question',
			'optionA',
			'optionB',
			'optionC',
			'optionD',
			'explanation',
			'correctAnswer'
		],
		requiredArrays: [],
		requiredNumbers: ['randomKey'],
		requiredBooleans: ['active']
	},
	{
		type: 'frq',
		source: process.env.SOURCE_FRQ_POOL_COLLECTION ?? 'frqquestions',
		target: process.env.TARGET_FRQ_POOL_COLLECTION ?? 'frqquestions_pool_v2',
		required: [
			'apClass',
			'unit',
			'contentHash',
			's3QuestionId',
			'formatId',
			'profileVersion',
			'promptVersion',
			'rubricVersion',
			'schemaVersion',
			'prompt',
			'sections',
			'rubric',
			'totalPoints',
			'topicsCovered',
			'randomKey',
			'active'
		],
		requiredStrings: [
			'apClass',
			'unit',
			'contentHash',
			's3QuestionId',
			'formatId',
			'profileVersion',
			'promptVersion',
			'rubricVersion',
			'prompt',
			'topicsCovered'
		],
		requiredArrays: ['sections', 'rubric'],
		requiredNumbers: ['schemaVersion', 'totalPoints', 'randomKey'],
		requiredBooleans: ['active']
	}
] as const;

if (!sourceUri) throw new Error('SOURCE_DATABASE_URI or DATABASE_URI is required');
if (!targetUri) throw new Error('TARGET_DATABASE_URI is required (or use --local-target)');
if (prepare && verifyOnly) throw new Error('Choose either --prepare or --verify');
if (prepare && confirmation !== 'PREPARE-POOL-V2') {
	throw new Error('--prepare requires --confirm=PREPARE-POOL-V2');
}

function databaseName(uri: string): string {
	const name = new URL(uri).pathname.slice(1);
	if (!name) throw new Error('Mongo URI must include a database name');
	return name;
}

function stable(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (value instanceof Date) return JSON.stringify(value.toISOString());
	if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
	const object = value as Record<string, unknown>;
	if (typeof object.toHexString === 'function') {
		return JSON.stringify((object.toHexString as () => string)());
	}
	return `{${Object.keys(object)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stable(object[key])}`)
		.join(',')}}`;
}

async function digestCollection(collection: Collection<Document>): Promise<string> {
	const hash = createHash('sha256');
	for await (const doc of collection.find(activeFilter).sort({ _id: 1 })) hash.update(stable(doc));
	return hash.digest('hex');
}

async function duplicateCount(collection: Collection<Document>, field: string): Promise<number> {
	const rows = await collection
		.aggregate([
			{ $match: { ...activeFilter, [field]: { $type: 'string', $ne: '' } } },
			{ $group: { _id: `$${field}`, count: { $sum: 1 } } },
			{ $match: { count: { $gt: 1 } } },
			{ $count: 'count' }
		])
		.toArray();
	return Number(rows[0]?.count ?? 0);
}

async function auditCollection(
	collection: Collection<Document>,
	pair: (typeof collectionPairs)[number]
) {
	const violations: Document[] = [
		...pair.required.map((field) => ({ [field]: { $exists: false } })),
		...pair.requiredStrings.flatMap((field) => [
			{ [field]: { $not: { $type: 'string' } } },
			{ [field]: '' }
		]),
		...pair.requiredArrays.flatMap((field) => [
			{ [field]: { $not: { $type: 'array' } } },
			{ [field]: { $size: 0 } }
		]),
		...pair.requiredNumbers.map((field) => ({ [field]: { $not: { $type: 'number' } } })),
		...pair.requiredBooleans.map((field) => ({ [field]: { $not: { $type: 'bool' } } }))
	];
	const missingFilter = {
		$and: [activeFilter, { $or: violations }]
	};
	const total = await collection.countDocuments();
	const count = await collection.countDocuments(activeFilter);
	return {
		total,
		count,
		excludedInactive: total - count,
		missingRequired: await collection.countDocuments(missingFilter),
		duplicateContentHashes: await duplicateCount(collection, 'contentHash'),
		duplicateS3Ids: await duplicateCount(collection, 's3QuestionId'),
		digest: await digestCollection(collection)
	};
}

async function copyIndexes(source: Collection<Document>, target: Collection<Document>) {
	for (const index of await source.indexes()) {
		if (index.name === '_id_') continue;
		const options: IndexDescription = {
			name: index.name
		};
		if (index.unique != null) options.unique = index.unique;
		if (index.sparse != null) options.sparse = index.sparse;
		if (index.partialFilterExpression != null) {
			options.partialFilterExpression = index.partialFilterExpression;
		}
		if (index.expireAfterSeconds != null) options.expireAfterSeconds = index.expireAfterSeconds;
		await target.createIndex(index.key, options);
	}
}

async function copyCollection(source: Collection<Document>, target: Collection<Document>) {
	let copied = 0;
	let operations: Array<{
		replaceOne: { filter: { _id: unknown }; replacement: Document; upsert: true };
	}> = [];
	for await (const doc of source.find(activeFilter).sort({ _id: 1 })) {
		operations.push({
			replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true }
		});
		if (operations.length < batchSize) continue;
		await target.bulkWrite(operations, { ordered: false });
		copied += operations.length;
		operations = [];
	}
	if (operations.length) {
		await target.bulkWrite(operations, { ordered: false });
		copied += operations.length;
	}
	return copied;
}

function assertHealthy(label: string, audit: Awaited<ReturnType<typeof auditCollection>>) {
	if (audit.missingRequired > 0) throw new Error(`${label} has missing required fields`);
	if (audit.duplicateContentHashes > 0) throw new Error(`${label} has duplicate content hashes`);
	if (audit.duplicateS3Ids > 0) throw new Error(`${label} has duplicate S3 ids`);
}

async function migratePair(sourceDb: Db, targetDb: Db, pair: (typeof collectionPairs)[number]) {
	if (pair.source === pair.target && sourceDb.databaseName === targetDb.databaseName) {
		throw new Error(`Refusing to overwrite source collection ${pair.source}`);
	}
	const source = sourceDb.collection(pair.source);
	const target = targetDb.collection(pair.target);
	const sourceAudit = await auditCollection(source, pair);
	assertHealthy(`source ${pair.source}`, sourceAudit);

	let copied = 0;
	if (prepare) {
		copied = await copyCollection(source, target);
		await copyIndexes(source, target);
	}

	const targetAudit = await auditCollection(target, pair);
	if (prepare || verifyOnly) {
		assertHealthy(`target ${pair.target}`, targetAudit);
		if (targetAudit.count !== sourceAudit.count || targetAudit.digest !== sourceAudit.digest) {
			throw new Error(`Verification mismatch for ${pair.source} -> ${pair.target}`);
		}
	}

	return { ...pair, copied, sourceAudit, targetAudit };
}

async function main() {
	const sourceClient = new MongoClient(sourceUri);
	const targetClient = new MongoClient(targetUri);
	await Promise.all([sourceClient.connect(), targetClient.connect()]);
	try {
		const sourceDb = sourceClient.db(databaseName(sourceUri));
		const targetDb = targetClient.db(databaseName(targetUri));
		const results = [];
		for (const pair of collectionPairs) results.push(await migratePair(sourceDb, targetDb, pair));
		console.log(
			JSON.stringify(
				{
					mode: prepare ? 'prepare' : verifyOnly ? 'verify' : 'dry-run',
					sourceDatabase: sourceDb.databaseName,
					targetDatabase: targetDb.databaseName,
					results
				},
				null,
				2
			)
		);
	} finally {
		await Promise.all([sourceClient.close(), targetClient.close()]);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
