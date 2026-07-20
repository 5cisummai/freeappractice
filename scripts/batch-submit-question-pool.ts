/**
 * scripts/batch-submit-question-pool.ts
 *
 * Build + submit an OpenAI Batch (~50% cheaper) for MCQ pool deficits.
 * Caps at remaining daily generation budget (default ~500/day).
 *
 *   bun run pool:batch-submit
 *   bun run pool:batch-submit -- --limit 100 --dry-run
 *   bun run pool:batch-submit -- --class "AP Biology" --unit "Unit 1" --limit 20
 */

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
	countActivePoolRows,
	listCatalogBuckets
} from '../src/lib/questions/pool-refill-queue.server';
import {
	getDailyBudgetRemaining,
	releaseDailyGenerationBudget,
	reserveDailyGenerationBudget
} from '../src/lib/questions/pool-refill.server';
import { buildMcqPoolBatchJsonl, submitMcqPoolBatch } from '../src/lib/questions/pool-batch.server';
import { getRecentTopics } from '../src/lib/questions/recent-topic.server';
import { connectDb } from '../src/lib/server/db';
import { getMcqGenerationCountsByClass } from '../src/lib/questions/gen-stats.server';
import {
	QUESTION_POOL_CONFIG,
	poolTargetForBucket
} from '../src/lib/questions/pool-constants';

function argValue(flag: string): string | undefined {
	const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
	if (eq) return eq.slice(flag.length + 1);
	const idx = process.argv.indexOf(flag);
	return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function argInt(flag: string, fallback: number): number {
	const raw = argValue(flag);
	const n = Number.parseInt(raw ?? '', 10);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

const dryRun = process.argv.includes('--dry-run');
const classFilter = argValue('--class');
const unitFilter = argValue('--unit');
const limit = argInt('--limit', 500);

const MANIFEST_DIR = path.resolve('tmp/pool-batches');

async function main() {
	if (!process.env.DATABASE_URI) {
		console.error('DATABASE_URI is not set');
		process.exit(1);
	}
	if (!dryRun && !process.env.OPEN_AI_KEY) {
		console.error('OPEN_AI_KEY is not set');
		process.exit(1);
	}

	const env = QUESTION_POOL_CONFIG;
	await connectDb();
	const generationCountsByClass = await getMcqGenerationCountsByClass();

	const budgetRemaining = await getDailyBudgetRemaining(env);
	const maxRequests = dryRun ? limit : Math.min(limit, budgetRemaining);
	console.log('Pool batch submit', {
		mcqDefaultTarget: env.mcqTarget,
		dailyBudget: env.dailyLlmGenerationBudget,
		budgetRemaining,
		limit,
		maxRequests,
		classFilter: classFilter ?? null,
		unitFilter: unitFilter ?? null,
		dryRun
	});

	if (!dryRun && maxRequests <= 0) {
		console.log('No daily budget remaining. Wait for next UTC day or raise QUESTION_POOL_DAILY_LLM_GENERATION_BUDGET in pool-constants.ts.');
		process.exit(0);
	}

	type Slot = { apClass: string; unit: string };
	const slots: Slot[] = [];

	for (const bucket of listCatalogBuckets('mcq')) {
		if (classFilter && bucket.apClass !== classFilter) continue;
		if (unitFilter && bucket.unit !== unitFilter) continue;
		const active = await countActivePoolRows('mcq', bucket.apClass, bucket.unit);
		const target = poolTargetForBucket({
			questionType: 'mcq',
			apClass: bucket.apClass,
			generationCountsByClass,
			config: env
		});
		const need = Math.max(0, target - active);
		for (let i = 0; i < need && slots.length < maxRequests; i += 1) {
			slots.push({ apClass: bucket.apClass, unit: bucket.unit });
		}
		if (slots.length >= maxRequests) break;
	}

	if (slots.length === 0) {
		console.log('No MCQ deficits to fill for the given filters.');
		process.exit(0);
	}

	const topicCache = new Map<string, string[]>();
	const requests = [];
	for (let i = 0; i < slots.length; i += 1) {
		const slot = slots[i]!;
		const cacheKey = `${slot.apClass}::${slot.unit}`;
		let recentTopics = topicCache.get(cacheKey);
		if (!recentTopics) {
			recentTopics = await getRecentTopics(slot.apClass, slot.unit).catch(() => []);
			topicCache.set(cacheKey, recentTopics);
		}
		requests.push({
			customId: `mcq-${String(i + 1).padStart(4, '0')}`,
			apClass: slot.apClass,
			unit: slot.unit,
			recentTopics
		});
	}

	const { jsonl, manifest } = buildMcqPoolBatchJsonl({ requests });
	console.log(`Built ${requests.length} batch requests (${jsonl.length} bytes JSONL)`);

	if (dryRun) {
		await mkdir(MANIFEST_DIR, { recursive: true });
		const dryPath = path.join(MANIFEST_DIR, `dry-run-${Date.now()}.jsonl`);
		await writeFile(dryPath, jsonl, 'utf8');
		console.log(`Dry-run JSONL written to ${dryPath}`);
		process.exit(0);
	}

	const reserved = await reserveDailyGenerationBudget(env, requests.length);
	if (reserved < requests.length) {
		if (reserved > 0) {
			const refunded = await releaseDailyGenerationBudget(reserved);
			console.error(
				`Could only reserve ${reserved}/${requests.length} budget slots (concurrent fill?). Refunded ${refunded}. Aborting without submit.`
			);
		} else {
			console.error(
				`Could only reserve ${reserved}/${requests.length} budget slots (concurrent fill?). Aborting without submit.`
			);
		}
		process.exit(1);
	}

	const idempotencyKey = `pool-mcq-${randomUUID()}`;
	try {
		const submitted = await submitMcqPoolBatch({
			jsonl,
			idempotencyKey,
			filename: `pool-mcq-${Date.now()}.jsonl`
		});

		await mkdir(MANIFEST_DIR, { recursive: true });
		const manifestPath = path.join(MANIFEST_DIR, `${submitted.batchId}.json`);
		await writeFile(
			manifestPath,
			JSON.stringify(
				{
					...manifest,
					batchId: submitted.batchId,
					inputFileId: submitted.inputFileId,
					status: submitted.status,
					requestCount: requests.length,
					idempotencyKey
				},
				null,
				2
			),
			'utf8'
		);

		console.log('Submitted OpenAI batch', {
			batchId: submitted.batchId,
			status: submitted.status,
			inputFileId: submitted.inputFileId,
			requestCount: requests.length,
			manifestPath
		});
		console.log(
			`Collect later with: bun run pool:batch-collect -- --batch ${submitted.batchId}`
		);
	} catch (error) {
		const refunded = await releaseDailyGenerationBudget(reserved);
		console.error(
			`Batch submit failed after budget reservation — refunded ${refunded}/${reserved} slots:`,
			error
		);
		process.exit(1);
	}

	process.exit(0);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
