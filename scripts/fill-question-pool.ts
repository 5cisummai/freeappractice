/**
 * scripts/fill-question-pool.ts
 *
 * Local/ops helper: enqueue catalog deficits, then loop the refill worker until
 * pending work is drained or the daily budget is exhausted.
 *
 *   bun run pool:fill
 *   bun run pool:fill --type mcq
 *   bun run pool:fill --max-rounds 50
 */

import 'dotenv/config';
import {
	enqueueAllCatalogDeficits,
	listCatalogBuckets,
	countActivePoolRows,
	requestPoolRefill
} from '../src/lib/question-bank/pool-refill-queue.server';
import { countOpenPoolRefillJobs } from '../src/lib/question-bank/pool-counts.server';
import { runQuestionPoolRefillWorker } from '../src/lib/question-bank/pool-refill.server';
import { getMcqGenerationCountsByClass } from '../src/lib/question-bank/gen-stats.server';
import { QUESTION_POOL_CONFIG } from '../src/lib/question-bank/pool-constants';
import {
	getPoolKindAdapter,
	POOL_QUESTION_TYPES
} from '../src/lib/question-bank/pool-kinds.server';

const typeFilter = (
	process.argv.find((arg) => arg.startsWith('--type='))?.slice('--type='.length) ??
	(process.argv.includes('--type') ? process.argv[process.argv.indexOf('--type') + 1] : 'all')
).toLowerCase();

const maxRounds = Math.max(
	1,
	Number.parseInt(
		process.argv.find((arg) => arg.startsWith('--max-rounds='))?.slice('--max-rounds='.length) ??
			(process.argv.includes('--max-rounds')
				? (process.argv[process.argv.indexOf('--max-rounds') + 1] ?? '200')
				: '200'),
		10
	) || 200
);

async function printDeficitSummary(
	generationCountsByClass: Record<string, number>
): Promise<{ deficit: number; pending: number }> {
	const env = QUESTION_POOL_CONFIG;
	let deficit = 0;
	const types =
		typeFilter === 'mcq' || typeFilter === 'frq' ? ([typeFilter] as const) : POOL_QUESTION_TYPES;

	for (const questionType of types) {
		const adapter = getPoolKindAdapter(questionType);
		for (const bucket of listCatalogBuckets(questionType)) {
			const target = adapter.targetFor({
				apClass: bucket.apClass,
				generationCountsByClass,
				config: env
			});
			const active = await countActivePoolRows(questionType, bucket.apClass, bucket.unit);
			deficit += Math.max(0, target - active);
		}
	}

	const pending = await countOpenPoolRefillJobs(
		typeFilter === 'mcq' || typeFilter === 'frq' ? typeFilter : undefined
	);

	console.log(`Deficit remaining: ${deficit}`);
	console.log(`Open refill jobs: ${pending}`);
	return { deficit, pending };
}

async function main() {
	if (!process.env.DATABASE_URL) {
		console.error('DATABASE_URL is not set');
		process.exit(1);
	}

	const env = QUESTION_POOL_CONFIG;
	console.log('Pool fill starting', {
		mcqDefaultTarget: env.mcqTarget,
		frqTarget: env.frqTarget,
		dailyBudget: env.dailyLlmGenerationBudget,
		maxGenerationsPerRun: env.maxGenerationsPerRun,
		typeFilter,
		maxRounds
	});

	const generationCountsByClass = await getMcqGenerationCountsByClass();
	await printDeficitSummary(generationCountsByClass);

	let enqueued = 0;
	if (typeFilter === 'mcq' || typeFilter === 'frq') {
		const adapter = getPoolKindAdapter(typeFilter);
		for (const bucket of listCatalogBuckets(typeFilter)) {
			const target = adapter.targetFor({
				apClass: bucket.apClass,
				generationCountsByClass,
				config: env
			});
			const active = await countActivePoolRows(typeFilter, bucket.apClass, bucket.unit);
			if (active < target) {
				await requestPoolRefill(bucket, env, generationCountsByClass);
				enqueued += 1;
			}
		}
	} else {
		enqueued = await enqueueAllCatalogDeficits(env);
	}
	console.log(`Enqueued deficit buckets: ${enqueued}`);

	let totalGenerated = 0;
	let totalSkipped = 0;
	let totalFailed = 0;

	for (let round = 1; round <= maxRounds; round += 1) {
		const summary = await runQuestionPoolRefillWorker(env, {
			owner: `fill-script-${round}`,
			startedAt: Date.now(),
			...(typeFilter === 'mcq' || typeFilter === 'frq' ? { questionType: typeFilter } : {})
		});
		totalGenerated += summary.generated;
		totalSkipped += summary.skippedDuplicates;
		totalFailed += summary.failed;

		console.log(
			`Round ${round}: generated=${summary.generated} skipped=${summary.skippedDuplicates} failed=${summary.failed} processed=${summary.processed} stopped=${summary.stoppedReason} budgetRemaining=${summary.budgetRemaining}`
		);

		const { deficit, pending } = await printDeficitSummary(generationCountsByClass);
		if (summary.stoppedReason === 'daily_budget') {
			console.log('Stopped: daily LLM budget exhausted.');
			break;
		}
		if (pending === 0 || deficit === 0 || summary.stoppedReason === 'no_work') {
			console.log('Stopped: no remaining refill work.');
			break;
		}
		if (summary.processed === 0 && summary.generated === 0) {
			console.log('Stopped: worker made no progress.');
			break;
		}
	}

	console.log('Fill complete', {
		totalGenerated,
		totalSkipped,
		totalFailed
	});
	await printDeficitSummary(generationCountsByClass);
	process.exit(0);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
