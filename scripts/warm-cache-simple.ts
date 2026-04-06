/**
 * scripts/warm-cache-simple.ts
 *
 * Warms the question pool by calling the app's own /api/question/cache/generate
 * endpoint — which uses the real ai.ts pipeline (correct models, full prompts,
 * unit context, deduplication, and topicsCovered diversity tracking).
 *
 * Requires the dev/preview server to be running first:
 *   pnpm dev           → target http://localhost:5173  (default)
 *   pnpm preview       → target http://localhost:4173
 *   WARM_CACHE_URL=https://freeappractice.org pnpm cache:warm
 *
 * Usage:
 *   pnpm cache:warm
 *   pnpm cache:warm --class "AP Biology"
 *   pnpm cache:warm --url http://localhost:4173
 *   pnpm cache:warm --concurrency 5
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import apClassesData from '../src/lib/data/ap-classes.json';

// ── Arg helpers ──────────────────────────────────────────────
function getArg(flag: string): string | undefined {
	const idx = process.argv.indexOf(flag);
	return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined;
}

const BASE_URL = (
	getArg('--url') ??
	process.env.WARM_CACHE_URL ??
	process.env.PUBLIC_BASE_URL ??
	'http://localhost:5173'
).replace(/\/$/, '');
const POOL_SIZE = Math.max(1, parseInt(process.env.CACHE_POOL_SIZE ?? '', 10) || 5);
const CONCURRENCY = Math.max(1, parseInt(getArg('--concurrency') ?? '5', 10));
const filterClass = getArg('--class') ?? null;
const DATABASE_URI = process.env.DATABASE_URI;

const GENERATE_URL = `${BASE_URL}/api/question/cache/generate`;

// ── Minimal Mongoose schema to count current pool size ───────
const questionSchema = new mongoose.Schema({ apClass: String, unit: String }, { timestamps: true });
const Question = mongoose.models['Question'] || mongoose.model('Question', questionSchema);

// ── Single slot: delegate to the real generate endpoint ──────
async function generateSlot(
	className: string,
	unit: string,
	slot: number,
	total: number
): Promise<'ok' | 'error'> {
	try {
		const res = await fetch(GENERATE_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ className, unit })
		});
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			process.stderr.write(`  [${slot}/${total}] HTTP ${res.status}: ${body.slice(0, 160)}\n`);
			return 'error';
		}
		process.stdout.write(`  [${slot}/${total}] ok\n`);
		return 'ok';
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		process.stderr.write(`  [${slot}/${total}] FAILED: ${msg}\n`);
		return 'error';
	}
}

// ── Simple concurrency limiter ────────────────────────────────
function createLimiter(max: number) {
	let running = 0;
	const queue: Array<() => void> = [];

	function next() {
		if (running >= max || queue.length === 0) return;
		running++;
		queue.shift()!();
	}

	return async function limit<T>(fn: () => Promise<T>): Promise<T> {
		await new Promise<void>((resolve) => {
			queue.push(resolve);
			next();
		});
		try {
			return await fn();
		} finally {
			running--;
			next();
		}
	};
}

// ── Main ────────────────────────────────────────────────────
async function main() {
	// Verify the server is reachable before doing real work
	try {
		const probe = await fetch(`${BASE_URL}/health`);
		if (!probe.ok) throw new Error(`Health check returned ${probe.status}`);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`\nCannot reach server at ${BASE_URL}`);
		console.error('Start it first:  pnpm dev   (or:  pnpm preview)\n');
		console.error(msg);
		process.exit(1);
	}

	if (!DATABASE_URI) {
		console.error('DATABASE_URI must be set in .env to count current pool sizes.');
		process.exit(1);
	}

	await mongoose.connect(DATABASE_URI, { serverSelectionTimeoutMS: 10_000 });

	type Course = { name: string; semester1: string[]; semester2: string[] };
	let courses = (apClassesData as { courses: Course[] }).courses;

	if (filterClass) {
		courses = courses.filter((c) => c.name === filterClass);
		if (courses.length === 0) {
			console.error(`No course found matching "${filterClass}".`);
			await mongoose.disconnect();
			process.exit(1);
		}
	}

	const combos: { className: string; unit: string }[] = [];
	for (const course of courses) {
		for (const unit of [...course.semester1, ...course.semester2]) {
			combos.push({ className: course.name, unit });
		}
	}

	console.log('\nWarm-cache');
	console.log(`  Server      : ${BASE_URL}`);
	console.log(`  Pool size   : ${POOL_SIZE}`);
	console.log(`  Concurrency : ${CONCURRENCY} parallel slots per unit`);
	console.log(`  Class filter: ${filterClass ?? '(all)'}`);
	console.log(`  Combos      : ${combos.length}\n`);

	const stats = { generated: 0, errors: 0, skipped: 0 };
	const limit = createLimiter(CONCURRENCY);

	for (const combo of combos) {
		const current = await Question.countDocuments({ apClass: combo.className, unit: combo.unit });
		const needed = POOL_SIZE - current;

		if (needed <= 0) {
			console.log(`  SKIP  ${combo.className} / ${combo.unit}  (${current}/${POOL_SIZE})`);
			stats.skipped++;
			continue;
		}

		console.log(`\n→ ${combo.className} / ${combo.unit}  (${current} in pool, need ${needed})`);

		const results = await Promise.all(
			Array.from({ length: needed }, (_, i) =>
				limit(() => generateSlot(combo.className, combo.unit, i + 1, needed))
			)
		);

		stats.generated += results.filter((r) => r === 'ok').length;
		stats.errors += results.filter((r) => r === 'error').length;
	}

	console.log('\n── Summary ───────────────────────────────────');
	console.log(`  Generated : ${stats.generated}`);
	console.log(`  Errors    : ${stats.errors}`);
	console.log(`  Skipped   : ${stats.skipped} (already full)`);

	await mongoose.disconnect();
	if (stats.errors > 0) process.exitCode = 1;
}

main();
