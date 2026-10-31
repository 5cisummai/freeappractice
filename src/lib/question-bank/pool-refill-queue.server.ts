import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { getMcqGenerationCountsByCourse } from '#lib/question-bank/gen-stats.server.js';
import { getUnitsForCourse } from '#lib/catalog/courses.js';
import { frqBucketUnits } from '#lib/question-bank/frq/practice.js';
import {
	countActivePoolRows,
	countActivePoolRowsByBucket,
	countActivePoolRowsForServing,
	countActivePoolRowsForServingByBucket,
	getPoolRefillHealthCounts
} from '#lib/question-bank/pool-counts.server.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { poolRefillStates } from '#lib/server/neon/schema.js';
import { getPoolKindAdapter, POOL_QUESTION_TYPES } from '#lib/question-bank/pool-kinds.server.js';
import type { PoolRefillQuestionType } from '#lib/question-bank/pool-refill-types.server.js';
import {
	QUESTION_POOL_CONFIG,
	isBelowLowWater,
	type QuestionPoolConfig
} from '#lib/question-bank/pool-constants.js';

export type PoolBucketKey = {
	questionType: PoolRefillQuestionType;
	course: string;
	unit: string;
};

export class InvalidPoolBucketError extends Error {
	constructor(bucket: Pick<PoolBucketKey, 'course' | 'unit'>) {
		super(`Invalid catalog pool bucket: ${bucket.course} / ${bucket.unit}`);
		this.name = 'InvalidPoolBucketError';
	}
}

export function isValidPoolBucket(
	bucket: Pick<PoolBucketKey, 'course' | 'unit'> & Partial<Pick<PoolBucketKey, 'questionType'>>
): boolean {
	const course = bucket.course.trim();
	const unit = bucket.unit.trim();
	if (bucket.questionType === 'frq') return frqBucketUnits(course).includes(unit);
	return getUnitsForCourse(course).includes(unit);
}

function normalizePoolBucket(bucket: PoolBucketKey): PoolBucketKey {
	return {
		questionType: bucket.questionType,
		course: bucket.course.trim(),
		unit: bucket.unit.trim()
	};
}

export function listCatalogBuckets(questionType: PoolRefillQuestionType): PoolBucketKey[] {
	return getPoolKindAdapter(questionType).listBuckets();
}

export {
	countActivePoolRows,
	countActivePoolRowsByBucket,
	countActivePoolRowsForServing,
	countActivePoolRowsForServingByBucket,
	getPoolRefillHealthCounts
};

/**
 * Upsert a refill request for a bucket. Safe to call from request paths (no LLM).
 * Never demotes a live `running` lease to `pending`.
 */
export async function requestPoolRefill(
	bucket: PoolBucketKey,
	env: QuestionPoolConfig = QUESTION_POOL_CONFIG,
	generationCountsByCourse?: Record<string, number>,
	observedCountOverride?: number
): Promise<void> {
	if (!isValidPoolBucket(bucket)) throw new InvalidPoolBucketError(bucket);
	bucket = normalizePoolBucket(bucket);

	const counts =
		generationCountsByCourse ??
		(bucket.questionType === 'mcq' ? await getMcqGenerationCountsByCourse() : {});
	const target = getPoolKindAdapter(bucket.questionType).targetFor({
		course: bucket.course,
		generationCountsByCourse: counts,
		config: env
	});
	const observedCount =
		observedCountOverride ??
		(await countActivePoolRowsForServing(bucket.questionType, bucket.course, bucket.unit));
	const now = new Date();
	const key = {
		questionType: bucket.questionType,
		course: bucket.course,
		unit: bucket.unit
	};

	// Refresh counts only — do not touch status/lease here (stomping a live lease is unsafe).
	await getNeonDatabase()
		.insert(poolRefillStates)
		.values({
			id: randomUUID(),
			...key,
			target,
			observedCount,
			requestedAt: now,
			status: observedCount < target ? 'pending' : 'idle',
			attempts: 0,
			generatedCount: 0,
			leaseOwner: null,
			leaseExpiresAt: null,
			lastError: null,
			nextAttemptAt: observedCount < target ? now : null
		})
		.onConflictDoUpdate({
			target: [poolRefillStates.questionType, poolRefillStates.course, poolRefillStates.unit],
			set: { target, observedCount, requestedAt: now, updatedAt: now }
		});

	if (observedCount < target) {
		// Promote to pending only when not holding a live lease.
		await getNeonDatabase()
			.update(poolRefillStates)
			.set({
				status: 'pending',
				target,
				observedCount,
				requestedAt: now,
				nextAttemptAt: now,
				lastError: null,
				leaseOwner: null,
				leaseExpiresAt: null,
				updatedAt: now
			})
			.where(
				and(
					eq(poolRefillStates.questionType, key.questionType),
					eq(poolRefillStates.course, key.course),
					eq(poolRefillStates.unit, key.unit),
					or(
						inArray(poolRefillStates.status, ['idle', 'failed', 'budget_exhausted', 'pending']),
						and(eq(poolRefillStates.status, 'running'), isNull(poolRefillStates.leaseExpiresAt)),
						and(eq(poolRefillStates.status, 'running'), lte(poolRefillStates.leaseExpiresAt, now))
					)
				)
			);
		return;
	}

	// At/above target: idle only if not actively running with a live lease.
	await getNeonDatabase()
		.update(poolRefillStates)
		.set({
			status: 'idle',
			observedCount,
			target,
			leaseOwner: null,
			leaseExpiresAt: null,
			lastError: null,
			nextAttemptAt: null,
			updatedAt: now
		})
		.where(
			and(
				eq(poolRefillStates.questionType, key.questionType),
				eq(poolRefillStates.course, key.course),
				eq(poolRefillStates.unit, key.unit),
				or(
					inArray(poolRefillStates.status, ['pending', 'failed', 'budget_exhausted']),
					and(eq(poolRefillStates.status, 'running'), isNull(poolRefillStates.leaseExpiresAt)),
					and(eq(poolRefillStates.status, 'running'), lte(poolRefillStates.leaseExpiresAt, now))
				)
			)
		);
}

type CatalogRefillSnapshot = PoolBucketKey & {
	id: string;
	target: number;
	observedCount: number;
};

function catalogBucketKey(bucket: PoolBucketKey): string {
	return `${bucket.course}\u0000${bucket.unit}`;
}

function refillSnapshotPayload(rows: CatalogRefillSnapshot[]): string {
	return JSON.stringify(
		rows.map((row) => ({
			id: row.id,
			questionType: row.questionType,
			course: row.course,
			unit: row.unit,
			target: row.target,
			observedCount: row.observedCount
		}))
	);
}

function incomingRefillSnapshots(rows: CatalogRefillSnapshot[]) {
	return sql`
		SELECT *
		FROM jsonb_to_recordset(${refillSnapshotPayload(rows)}::jsonb) AS row(
			"id" text,
			"questionType" text,
			"course" text,
			"unit" text,
			"target" integer,
			"observedCount" integer
		)
	`;
}

async function listCatalogRefillSnapshots(
	env: QuestionPoolConfig
): Promise<CatalogRefillSnapshot[]> {
	const generationCountsByCourse = await getMcqGenerationCountsByCourse();
	const snapshots: CatalogRefillSnapshot[] = [];
	for (const questionType of POOL_QUESTION_TYPES) {
		const adapter = getPoolKindAdapter(questionType);
		const observedByBucket = await countActivePoolRowsByBucket(questionType);
		for (const bucket of listCatalogBuckets(questionType)) {
			const normalized = normalizePoolBucket(bucket);
			snapshots.push({
				id: randomUUID(),
				...normalized,
				target: adapter.targetFor({
					course: normalized.course,
					generationCountsByCourse,
					config: env
				}),
				observedCount: observedByBucket.get(catalogBucketKey(normalized)) ?? 0
			});
		}
	}
	return snapshots;
}

async function upsertRefillSnapshots(
	rows: CatalogRefillSnapshot[],
	now: Date,
	opts: { touchRequestedAt: boolean }
): Promise<void> {
	if (!rows.length) return;
	const incoming = incomingRefillSnapshots(rows);
	const insertSelect = sql`
		INSERT INTO ${poolRefillStates} (
			id,
			question_type,
			course,
			unit,
			status,
			target,
			observed_count,
			requested_at,
			attempts,
			generated_count,
			lease_owner,
			lease_expires_at,
			created_at,
			updated_at
		)
		SELECT
			"id",
			"questionType",
			course,
			unit,
			'idle',
			target,
			"observedCount",
			${now},
			0,
			0,
			NULL,
			NULL,
			${now},
			${now}
		FROM (${incoming}) AS incoming
	`;
	if (opts.touchRequestedAt) {
		await getNeonDatabase().execute(sql`
			${insertSelect}
			ON CONFLICT (question_type, course, unit) DO UPDATE
			SET
				target = EXCLUDED.target,
				observed_count = EXCLUDED.observed_count,
				requested_at = EXCLUDED.requested_at,
				updated_at = EXCLUDED.updated_at
		`);
		return;
	}
	await getNeonDatabase().execute(sql`
		${insertSelect}
		ON CONFLICT (question_type, course, unit) DO UPDATE
		SET
			target = EXCLUDED.target,
			observed_count = EXCLUDED.observed_count,
			updated_at = EXCLUDED.updated_at
	`);
}

async function promotePendingRefillSnapshots(
	rows: CatalogRefillSnapshot[],
	now: Date
): Promise<void> {
	if (!rows.length) return;
	await getNeonDatabase().execute(sql`
		UPDATE ${poolRefillStates} AS target
		SET
			status = 'pending',
			target = incoming.target,
			observed_count = incoming."observedCount",
			requested_at = ${now},
			next_attempt_at = ${now},
			last_error = NULL,
			lease_owner = NULL,
			lease_expires_at = NULL,
			updated_at = ${now}
		FROM (${incomingRefillSnapshots(rows)}) AS incoming
		WHERE target.question_type = incoming."questionType"
			AND target.course = incoming.course
			AND target.unit = incoming.unit
			AND (
				target.status IN ('idle', 'failed', 'budget_exhausted', 'pending')
				OR (
					target.status = 'running'
					AND (target.lease_expires_at IS NULL OR target.lease_expires_at <= ${now})
				)
			)
	`);
}

async function idleAtTargetRefillSnapshots(
	rows: CatalogRefillSnapshot[],
	now: Date
): Promise<void> {
	if (!rows.length) return;
	await getNeonDatabase().execute(sql`
		UPDATE ${poolRefillStates} AS target
		SET
			status = 'idle',
			lease_owner = NULL,
			lease_expires_at = NULL,
			last_error = NULL,
			next_attempt_at = NULL,
			updated_at = ${now}
		FROM (${incomingRefillSnapshots(rows)}) AS incoming
		WHERE target.question_type = incoming."questionType"
			AND target.course = incoming.course
			AND target.unit = incoming.unit
			AND (
				target.status IN ('pending', 'failed', 'budget_exhausted')
				OR (
					target.status = 'running'
					AND (target.lease_expires_at IS NULL OR target.lease_expires_at <= ${now})
				)
			)
	`);
}

/**
 * Full-catalog count + enqueue. Two grouped counts plus a constant number of
 * upsert/promote statements. Use from admin/ops, not every cron tick.
 */
export async function reconcilePoolRefillJobs(
	env: QuestionPoolConfig = QUESTION_POOL_CONFIG
): Promise<{ reconciled: number; enqueued: number }> {
	const snapshots = await listCatalogRefillSnapshots(env);
	const now = new Date();
	const belowLowWater = snapshots.filter((row) =>
		isBelowLowWater(row.observedCount, row.target, env.lowWaterRatio)
	);
	const atTarget = snapshots.filter((row) => row.observedCount >= row.target);
	await upsertRefillSnapshots(snapshots, now, { touchRequestedAt: false });
	await promotePendingRefillSnapshots(belowLowWater, now);
	await idleAtTargetRefillSnapshots(atTarget, now);
	return { reconciled: snapshots.length, enqueued: belowLowWater.length };
}

/** Enqueue every catalog bucket still below target (post-backfill stage 2). */
export async function enqueueAllCatalogDeficits(
	env: QuestionPoolConfig = QUESTION_POOL_CONFIG
): Promise<number> {
	const belowTarget = (await listCatalogRefillSnapshots(env)).filter(
		(row) => row.observedCount < row.target
	);
	const now = new Date();
	await upsertRefillSnapshots(belowTarget, now, { touchRequestedAt: true });
	await promotePendingRefillSnapshots(belowTarget, now);
	return belowTarget.length;
}
