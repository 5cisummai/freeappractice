/**
 * Make the local serving pool canonical before a v2 migration.
 *
 * Dry-run (default):
 *   bun run pool:repair-local
 *
 * Apply the exact audited repair:
 *   bun run pool:repair-local -- --apply --confirm=REPAIR-LOCAL-POOL
 *
 * The repair is intentionally conservative:
 * - MCQs missing an S3 id are archived under a deterministic id, then linked.
 * - legacy FRQs that cannot satisfy the modern schema are retained but made inactive.
 * - no Mongo document or S3 object is deleted.
 */

import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { Question } from '$lib/questions/cache-model.server';
import { FrqQuestionModel } from '$lib/frq/model.server';
import { QuestionId } from '$lib/questions/question-id-model.server';
import { getObjectJson, putObject } from '$lib/questions/s3.server';

const apply = process.argv.includes('--apply');
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm='))?.slice(10);

if (!process.env.DATABASE_URI) throw new Error('DATABASE_URI is required');
if (apply && confirmation !== 'REPAIR-LOCAL-POOL') {
	throw new Error('--apply requires --confirm=REPAIR-LOCAL-POOL');
}

type LegacyMcq = {
	_id: mongoose.Types.ObjectId;
	apClass?: string;
	unit?: string;
	contentHash?: string;
	topicsCovered?: string;
	question?: string;
	optionA?: string;
	optionB?: string;
	optionC?: string;
	optionD?: string;
	correctAnswer?: string;
	explanation?: string;
	hint1?: string;
	hint2?: string;
	createdAt?: Date;
};

type StoredMcq = Omit<LegacyMcq, '_id' | 'createdAt'> & {
	id: string;
	createdAt: string;
};

const missingS3Id = {
	$or: [{ s3QuestionId: { $exists: false } }, { s3QuestionId: null }, { s3QuestionId: '' }]
};

function requireText(value: unknown, field: string, id: string): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new Error(`MCQ ${id} is missing ${field}`);
	}
	return value.trim();
}

function isMissingObject(error: unknown): boolean {
	const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
	return value?.name === 'NoSuchKey' || value?.$metadata?.httpStatusCode === 404;
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

function buildStoredMcq(doc: LegacyMcq): StoredMcq {
	const id = `local-${doc._id.toHexString()}`;
	const correctAnswer = requireText(doc.correctAnswer, 'correctAnswer', id).toUpperCase();
	if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
		throw new Error(`MCQ ${id} has an invalid correctAnswer`);
	}
	return {
		id,
		apClass: requireText(doc.apClass, 'apClass', id),
		unit: requireText(doc.unit, 'unit', id),
		contentHash: requireText(doc.contentHash, 'contentHash', id),
		topicsCovered: doc.topicsCovered ?? '',
		question: requireText(doc.question, 'question', id),
		optionA: requireText(doc.optionA, 'optionA', id),
		optionB: requireText(doc.optionB, 'optionB', id),
		optionC: requireText(doc.optionC, 'optionC', id),
		optionD: requireText(doc.optionD, 'optionD', id),
		correctAnswer,
		explanation: requireText(doc.explanation, 'explanation', id),
		hint1: doc.hint1 ?? '',
		hint2: doc.hint2 ?? '',
		createdAt: (doc.createdAt ?? new Date(0)).toISOString()
	};
}

function isModernFrq(doc: Record<string, unknown>): boolean {
	return (
		typeof doc.s3QuestionId === 'string' &&
		doc.s3QuestionId.trim().length > 0 &&
		Array.isArray(doc.sections) &&
		doc.sections.length > 0 &&
		Array.isArray(doc.rubric) &&
		doc.rubric.length > 0
	);
}

async function archiveMcq(doc: LegacyMcq): Promise<void> {
	const payload = buildStoredMcq(doc);
	const key = `questions/${payload.id}.json`;
	let existing: StoredMcq | undefined;
	try {
		existing = await getObjectJson<StoredMcq>({ key });
	} catch (error) {
		if (!isMissingObject(error)) throw error;
	}

	if (existing && canonicalJson(existing) !== canonicalJson(payload)) {
		throw new Error(`Refusing to overwrite non-matching S3 object ${key}`);
	}
	if (!existing) {
		await putObject({ key, body: JSON.stringify(payload), contentType: 'application/json' });
	}

	const body = JSON.stringify(payload);
	await QuestionId.updateOne(
		{ questionId: payload.id },
		{
			$setOnInsert: { questionId: payload.id },
			$set: {
				apClass: payload.apClass,
				unit: payload.unit,
				questionCreatedAt: new Date(payload.createdAt),
				contentHash: createHash('sha256').update(body).digest('hex'),
				contentLength: body.length,
				metadataSyncedAt: new Date()
			}
		},
		{ upsert: true }
	);
	const result = await Question.updateOne(
		{ _id: doc._id, ...missingS3Id },
		{ $set: { s3QuestionId: payload.id } }
	);
	if (result.modifiedCount !== 1) throw new Error(`Failed to link MCQ ${payload.id}`);
}

async function main() {
	await mongoose.connect(process.env.DATABASE_URI!, { serverSelectionTimeoutMS: 10_000 });
	try {
		const legacyMcqs = (await Question.find({
			active: { $ne: false },
			...missingS3Id
		}).lean()) as unknown as LegacyMcq[];
		const activeFrqs = (await FrqQuestionModel.find({
			active: { $ne: false }
		}).lean()) as unknown as Record<string, unknown>[];
		const legacyFrqIds = activeFrqs
			.filter((doc) => !isModernFrq(doc))
			.map((doc) => doc._id as mongoose.Types.ObjectId);

		console.log(
			JSON.stringify(
				{
					mode: apply ? 'apply' : 'dry-run',
					mcqsToArchiveAndLink: legacyMcqs.length,
					legacyFrqsToDeactivate: legacyFrqIds.length
				},
				null,
				2
			)
		);
		if (!apply) return;

		let archivedMcqs = 0;
		for (const doc of legacyMcqs) {
			await archiveMcq(doc);
			archivedMcqs += 1;
			if (archivedMcqs % 50 === 0) console.log(`Archived and linked ${archivedMcqs} MCQs…`);
		}
		const retired = legacyFrqIds.length
			? await FrqQuestionModel.collection.updateMany(
					{ _id: { $in: legacyFrqIds }, active: { $ne: false } },
					{ $set: { active: false, updatedAt: new Date() } }
				)
			: { modifiedCount: 0 };
		console.log(
			JSON.stringify({ archivedMcqs, deactivatedLegacyFrqs: retired.modifiedCount }, null, 2)
		);
	} finally {
		await mongoose.disconnect();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
