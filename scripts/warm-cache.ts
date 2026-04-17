/**
 * scripts/warm-cache.ts
 *
 * Pre-fills the question pool for every AP class + unit combination up to
 * CACHE_POOL_SIZE (defaults to 5, configurable via .env).
 *
 * Run via:
 *   pnpm cache:warm                       # fill all classes
 *   pnpm cache:warm --class "AP Biology"  # fill a single class
 *   pnpm cache:warm --dry-run             # show what would be generated, nothing inserted
 *   pnpm cache:warm --concurrency 3       # number of parallel class+unit workers (default 3)
 *
 * Requires DATABASE_URI and OPEN_AI_KEY in your .env.
 */

import { connectDb } from '../src/lib/server/db';
import { Question } from '../src/lib/server/models/question';
import { generateAPQuestion } from '../src/lib/server/services/ai';
import { getArg, createLimiter, loadCombos } from './shared';

const isDryRun = process.argv.includes('--dry-run');
const filterClass = getArg('--class');
const concurrencyArg = parseInt(getArg('--concurrency') ?? '', 10);
const MAX_CONCURRENT = isNaN(concurrencyArg) ? 3 : Math.max(1, concurrencyArg);
const POOL_SIZE = Math.max(1, parseInt(process.env.CACHE_POOL_SIZE ?? '', 10) || 5);

// ── Per class+unit fill logic ───────────────────────────────
async function fillUnit(
	className: string,
	unit: string,
	stats: { generated: number; skipped: number; failed: number }
) {
	const current = await Question.countDocuments({ apClass: className, unit });

	if (current >= POOL_SIZE) {
		process.stdout.write(`  SKIP  ${className} / ${unit} (${current}/${POOL_SIZE})\n`);
		stats.skipped++;
		return;
	}

	const needed = POOL_SIZE - current;

	if (isDryRun) {
		process.stdout.write(`  DRY   ${className} / ${unit} — would generate ${needed} question(s)\n`);
		stats.generated += needed;
		return;
	}

	for (let i = 0; i < needed; i++) {
		// Re-check before each insert so concurrent workers don't over-fill
		const live = await Question.countDocuments({ apClass: className, unit });
		if (live >= POOL_SIZE) break;

		try {
			const result = await generateAPQuestion({ className, unit });
			const { answer } = result;
			await Question.create({
				apClass: className,
				unit,
				question: answer.question,
				optionA: answer.optionA,
				optionB: answer.optionB,
				optionC: answer.optionC,
				optionD: answer.optionD,
				correctAnswer: answer.correctAnswer,
				explanation: answer.explanation,
				lastServedAt: null
			});
			stats.generated++;
			const after = await Question.countDocuments({ apClass: className, unit });
			process.stdout.write(`  GEN   ${className} / ${unit} (${after}/${POOL_SIZE})\n`);
		} catch (err) {
			stats.failed++;
			process.stderr.write(
				`  FAIL  ${className} / ${unit}: ${err instanceof Error ? err.message : String(err)}\n`
			);
			// Back off and continue to next unit rather than crashing the whole run
			await new Promise((r) => setTimeout(r, 2000));
		}
	}
}

// ── Main ───────────────────────────────────────────────────
async function main() {
	console.log(`\nWarm-cache script`);
	console.log(`  Pool size     : ${POOL_SIZE} (CACHE_POOL_SIZE)`);
	console.log(`  Concurrency   : ${MAX_CONCURRENT}`);
	console.log(`  Dry run       : ${isDryRun}`);
	console.log(`  Class filter  : ${filterClass ?? '(all)'}\n`);

	let { courses, combos } = loadCombos(filterClass);

	console.log(
		`Filling ${combos.length} class+unit combination(s) across ${courses.length} course(s).`
	);

	if (!isDryRun) {
		console.log('Connecting to MongoDB…');
		await connectDb();
		console.log('Connected.\n');
	}

	const stats = { generated: 0, skipped: 0, failed: 0 };
	const limit = createLimiter(MAX_CONCURRENT);

	await Promise.all(
		combos.map((combo) => limit(() => fillUnit(combo.className, combo.unit, stats)))
	);

	console.log('\n── Summary ──────────────────────────────');
	console.log(`  Generated : ${stats.generated}`);
	console.log(`  Skipped   : ${stats.skipped} (already at pool size)`);
	console.log(`  Failed    : ${stats.failed}`);
	console.log('─────────────────────────────────────────\n');

	if (stats.failed > 0) process.exitCode = 1;
}

import mongoose from 'mongoose';

main()
	.catch((err) => {
		console.error('Script failed:', err);
		process.exitCode = 1;
	})
	.finally(() => mongoose.disconnect());
