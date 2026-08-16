/**
 * scripts/batch-submit-question-pool.ts
 *
 * Build + submit an OpenAI Batch (~50% cheaper) for MCQ or FRQ pool deficits
 * vs `question-pool-targets.json` preferred ceilings (not demand-scaled).
 * Caps at remaining daily generation budget (default ~500/day).
 *
 *   bun run pool:batch-submit
 *   bun run pool:batch-submit -- --limit 100 --dry-run
 *   bun run pool:batch-submit -- --type frq --limit 200
 *   bun run pool:batch-submit -- --class "AP Biology" --unit "Unit 1" --limit 20
 */

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
	countActivePoolRows,
	listCatalogBuckets
} from '../src/lib/question-bank/pool-refill-queue.server';
import {
	getDailyBudgetRemaining,
	releaseDailyGenerationBudget,
	reserveDailyGenerationBudget
} from '../src/lib/question-bank/pool-refill.server';
import {
	buildFrqPoolBatchJsonl,
	buildMcqPoolBatchJsonl,
	submitMcqPoolBatch
} from '../src/lib/question-bank/pool-batch.server';
import { getRecentTopics } from '../src/lib/question-bank/recent-topic.server';
import { getRecentFrqTopics } from '../src/lib/question-bank/frq/generation.server';
import { QUESTION_POOL_CONFIG, preferredMcqTarget } from '../src/lib/question-bank/pool-constants';
import { isExamfigDiagramsEnabled } from '../src/lib/flags';

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
const questionType = (argValue('--type') ?? 'mcq').toLowerCase();
const classFilter = argValue('--class');
const unitFilter = argValue('--unit');
const limit = argInt('--limit', 500);

const MANIFEST_DIR = path.resolve('tmp/pool-batches');

async function main() {
	if (questionType !== 'mcq' && questionType !== 'frq') {
		console.error('--type must be mcq or frq');
		process.exit(1);
	}
	if (!process.env.DATABASE_URL) {
		console.error('DATABASE_URL is not set');
		process.exit(1);
	}
	if (!dryRun && !process.env.OPEN_AI_KEY) {
		console.error('OPEN_AI_KEY is not set');
		process.exit(1);
	}

	const env = QUESTION_POOL_CONFIG;
	const diagramsEnabled = questionType === 'mcq' ? await isExamfigDiagramsEnabled() : false;

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
		questionType,
		diagramsEnabled,
		dryRun,
		targetSource: 'question-pool-targets.json preferred ceilings'
	});

	if (!dryRun && maxRequests <= 0) {
		console.log(
			'No daily budget remaining. Wait for next UTC day or raise QUESTION_POOL_DAILY_LLM_GENERATION_BUDGET in pool-constants.ts.'
		);
		process.exit(0);
	}

	type Slot = { apClass: string; unit: string };
	type Deficit = Slot & { active: number; target: number; need: number };

	const deficits: Deficit[] = [];
	for (const bucket of listCatalogBuckets(questionType)) {
		if (classFilter && bucket.apClass !== classFilter) continue;
		if (unitFilter && bucket.unit !== unitFilter) continue;
		const active = await countActivePoolRows(questionType, bucket.apClass, bucket.unit);
		const target = questionType === 'mcq' ? preferredMcqTarget(bucket.apClass) : env.frqTarget;
		const need = Math.max(0, target - active);
		if (need > 0) {
			deficits.push({
				apClass: bucket.apClass,
				unit: bucket.unit,
				active,
				target,
				need
			});
		}
	}

	// Largest holes first so a capped run (e.g. 500) helps the neediest buckets.
	deficits.sort((a, b) => b.need - a.need || a.apClass.localeCompare(b.apClass));

	const totalNeed = deficits.reduce((sum, d) => sum + d.need, 0);
	console.log(`${questionType.toUpperCase()} preferred-target deficits`, {
		bucketsUnderTarget: deficits.length,
		totalNeed,
		willSubmit: Math.min(totalNeed, maxRequests)
	});

	const slots: Slot[] = [];
	for (const deficit of deficits) {
		for (let i = 0; i < deficit.need && slots.length < maxRequests; i += 1) {
			slots.push({ apClass: deficit.apClass, unit: deficit.unit });
		}
		if (slots.length >= maxRequests) break;
	}

	if (slots.length === 0) {
		console.log(
			`No ${questionType.toUpperCase()} deficits vs question-pool-targets.json preferred ceilings for the given filters.`
		);
		process.exit(0);
	}

	const topicCache = new Map<string, string[]>();
	const requests = [];
	for (let i = 0; i < slots.length; i += 1) {
		const slot = slots[i]!;
		const cacheKey = `${slot.apClass}::${slot.unit}`;
		let recentTopics = topicCache.get(cacheKey);
		if (!recentTopics) {
			recentTopics =
				questionType === 'mcq'
					? await getRecentTopics({ kind: 'mcq', apClass: slot.apClass, unit: slot.unit }).catch(
							() => []
						)
					: await getRecentFrqTopics(slot.apClass, slot.unit).catch(() => []);
			topicCache.set(cacheKey, recentTopics);
		}
		requests.push({
			customId: `${questionType}-${String(i + 1).padStart(4, '0')}`,
			apClass: slot.apClass,
			unit: slot.unit,
			recentTopics
		});
	}

	const { jsonl, manifest } =
		questionType === 'mcq'
			? buildMcqPoolBatchJsonl({ requests, diagramsEnabled })
			: buildFrqPoolBatchJsonl({ requests });
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
			filename: `pool-${questionType}-${Date.now()}.jsonl`,
			purpose: manifest.purpose
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
		console.log(`Collect later with: bun run pool:batch-collect -- --batch ${submitted.batchId}`);
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
