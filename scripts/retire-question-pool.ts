/**
 * scripts/retire-question-pool.ts
 *
 * Explicitly retire active PostgreSQL pool rows (set active=false). History and
 * bookmarks continue resolving the same Neon rows, but practice becomes
 * unavailable for affected buckets until refill restores inventory.
 *
 * Always prints an impact report. Writes require an explicit confirmation token.
 *
 *   bun run pool:retire --dry-run
 *   bun run pool:retire --confirm=RETIRE-POOL
 *   bun run pool:retire --type mcq --confirm=RETIRE-POOL
 *   bun run pool:retire --class "AP Biology" --unit "Unit 1" --confirm=RETIRE-POOL
 */

import 'dotenv/config';
import { Question } from '../src/lib/questions/cache-model.server';
import { FrqQuestionModel } from '../src/lib/frq/model.server';
import { connectDb } from '../src/lib/server/db';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('Error: DATABASE_URL is not set in your environment / .env file.');
	process.exit(1);
}

const CONFIRM_TOKEN = 'RETIRE-POOL';
const isDryRun = process.argv.includes('--dry-run');
const confirmArg = process.argv.find((arg) => arg.startsWith('--confirm='));
const confirmValue = confirmArg?.slice('--confirm='.length) ?? '';
const typeFilter = (
	process.argv.find((arg) => arg.startsWith('--type='))?.slice('--type='.length) ??
	getFlagValue('--type') ??
	'all'
).toLowerCase();
const classFilter =
	process.argv.find((arg) => arg.startsWith('--class='))?.slice('--class='.length) ??
	getFlagValue('--class');
const unitFilter =
	process.argv.find((arg) => arg.startsWith('--unit='))?.slice('--unit='.length) ??
	getFlagValue('--unit');

function getFlagValue(flag: string): string | undefined {
	const index = process.argv.indexOf(flag);
	if (index === -1) return undefined;
	return process.argv[index + 1];
}

type BucketRow = {
	_id: { apClass: string; unit: string };
	total: number;
};

function buildFilter(): Record<string, unknown> {
	const filter: Record<string, unknown> = { active: { $ne: false } };
	if (classFilter?.trim()) filter.apClass = classFilter.trim();
	if (unitFilter?.trim()) filter.unit = unitFilter.trim();
	return filter;
}

async function summarize(
	model: typeof Question | typeof FrqQuestionModel,
	filter: Record<string, unknown>
): Promise<{ total: number; buckets: BucketRow[] }> {
	const rows = await model.find(filter, { apClass: 1, unit: 1, _id: 0 }).lean();
	const grouped = new Map<string, BucketRow>();
	for (const row of rows) {
		const key = `${String(row.apClass)}\u0000${String(row.unit)}`;
		const current = grouped.get(key) ?? {
			_id: { apClass: String(row.apClass), unit: String(row.unit) },
			total: 0
		};
		current.total += 1;
		grouped.set(key, current);
	}
	const buckets = [...grouped.values()].sort(
		(a, b) =>
			b.total - a.total ||
			a._id.apClass.localeCompare(b._id.apClass) ||
			a._id.unit.localeCompare(b._id.unit)
	);
	return { total: rows.length, buckets };
}

function printBucketReport(label: string, buckets: BucketRow[], total: number): void {
	console.log(`\n${label}`);
	console.log(`  active rows: ${total}`);
	console.log(`  affected buckets: ${buckets.length}`);
	for (const bucket of buckets.slice(0, 40)) {
		console.log(`    - ${bucket._id.apClass} · ${bucket._id.unit}: ${bucket.total}`);
	}
	if (buckets.length > 40) {
		console.log(`    … and ${buckets.length - 40} more bucket(s)`);
	}
}

async function main() {
	if (typeFilter !== 'all' && typeFilter !== 'mcq' && typeFilter !== 'frq') {
		console.error('Error: --type must be all, mcq, or frq.');
		process.exit(1);
	}

	console.log('Connecting to Neon PostgreSQL…');
	await connectDb();
	console.log('Connected.');
	console.log(
		'Retiring Neon pool rows makes practice unavailable for affected buckets until refill restores them.'
	);

	const filter = buildFilter();
	const includeMcq = typeFilter === 'all' || typeFilter === 'mcq';
	const includeFrq = typeFilter === 'all' || typeFilter === 'frq';

	const mcq = includeMcq
		? await summarize(Question, filter)
		: { total: 0, buckets: [] as BucketRow[] };
	const frq = includeFrq
		? await summarize(FrqQuestionModel, filter)
		: { total: 0, buckets: [] as BucketRow[] };

	if (includeMcq) printBucketReport('MCQ pool impact', mcq.buckets, mcq.total);
	if (includeFrq) printBucketReport('FRQ pool impact', frq.buckets, frq.total);

	const affectedBuckets = new Set<string>();
	for (const bucket of [...mcq.buckets, ...frq.buckets]) {
		affectedBuckets.add(`${bucket._id.apClass}::${bucket._id.unit}`);
	}

	console.log(`\nTotal affected buckets (union): ${affectedBuckets.size}`);
	console.log(`Total active rows that would be retired: ${mcq.total + frq.total}`);

	if (isDryRun || confirmValue !== CONFIRM_TOKEN) {
		if (isDryRun) {
			console.log('\nDry-run mode — nothing retired.');
		} else {
			console.log(
				`\nRefusing to write without --confirm=${CONFIRM_TOKEN} (or pass --dry-run to preview only).`
			);
		}
		return;
	}

	if (mcq.total + frq.total === 0) {
		console.log('\nNothing to retire.');
		return;
	}

	let retired = 0;
	if (includeMcq && mcq.total > 0) {
		const result = await Question.updateMany(filter, { $set: { active: false } });
		retired += result.modifiedCount;
		console.log(`✓ Retired ${result.modifiedCount} MCQ row(s).`);
	}
	if (includeFrq && frq.total > 0) {
		const result = await FrqQuestionModel.updateMany(filter, { $set: { active: false } });
		retired += result.modifiedCount;
		console.log(`✓ Retired ${result.modifiedCount} FRQ row(s).`);
	}
	console.log(
		`✓ Done. Retired ${retired} active pool row(s) across ${affectedBuckets.size} bucket(s).`
	);
}

main().catch((err) => {
	console.error('Script failed:', err);
	process.exitCode = 1;
});
