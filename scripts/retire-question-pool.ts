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
import { and, eq, sql } from 'drizzle-orm';
import { getNeonDatabase } from '../src/lib/server/neon/db';
import { frqQuestions, mcqQuestions } from '../src/lib/server/neon/schema';
import { questionPayloadTextField } from '../src/lib/server/neon/jsonb';

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
	apClass: string;
	unit: string;
	total: number;
};

function buildConditions(table: typeof mcqQuestions | typeof frqQuestions) {
	const apClass = questionPayloadTextField(table.data, 'apClass');
	const unit = questionPayloadTextField(table.data, 'unit');
	return [
		eq(table.active, true),
		...(classFilter?.trim() ? [eq(apClass, classFilter.trim())] : []),
		...(unitFilter?.trim() ? [eq(unit, unitFilter.trim())] : [])
	];
}

async function summarize(
	table: typeof mcqQuestions | typeof frqQuestions
): Promise<{ total: number; buckets: BucketRow[] }> {
	const apClass = questionPayloadTextField(table.data, 'apClass');
	const unit = questionPayloadTextField(table.data, 'unit');
	const rows = await getNeonDatabase()
		.select({
			apClass,
			unit,
			total: sql<number>`count(*)`
		})
		.from(table)
		.where(and(...buildConditions(table)))
		.groupBy(apClass, unit);
	const buckets = rows.map((row) => ({
		apClass: row.apClass,
		unit: row.unit,
		total: Number(row.total)
	}));
	const total = buckets.reduce((sum, bucket) => sum + bucket.total, 0);
	buckets.sort(
		(a, b) =>
			b.total - a.total || a.apClass.localeCompare(b.apClass) || a.unit.localeCompare(b.unit)
	);
	return { total, buckets };
}

function printBucketReport(label: string, buckets: BucketRow[], total: number): void {
	console.log(`\n${label}`);
	console.log(`  active rows: ${total}`);
	console.log(`  affected buckets: ${buckets.length}`);
	for (const bucket of buckets.slice(0, 40)) {
		console.log(`    - ${bucket.apClass} · ${bucket.unit}: ${bucket.total}`);
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

	console.log(
		'Retiring Neon pool rows makes practice unavailable for affected buckets until refill restores them.'
	);

	const includeMcq = typeFilter === 'all' || typeFilter === 'mcq';
	const includeFrq = typeFilter === 'all' || typeFilter === 'frq';

	const mcq = includeMcq ? await summarize(mcqQuestions) : { total: 0, buckets: [] as BucketRow[] };
	const frq = includeFrq ? await summarize(frqQuestions) : { total: 0, buckets: [] as BucketRow[] };

	if (includeMcq) printBucketReport('MCQ pool impact', mcq.buckets, mcq.total);
	if (includeFrq) printBucketReport('FRQ pool impact', frq.buckets, frq.total);

	const affectedBuckets = new Set<string>();
	for (const bucket of [...mcq.buckets, ...frq.buckets]) {
		affectedBuckets.add(`${bucket.apClass}::${bucket.unit}`);
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
		const result = await getNeonDatabase()
			.update(mcqQuestions)
			.set({ active: false })
			.where(and(...buildConditions(mcqQuestions)))
			.returning({ questionId: mcqQuestions.questionId });
		retired += result.length;
		console.log(`✓ Retired ${result.length} MCQ row(s).`);
	}
	if (includeFrq && frq.total > 0) {
		const result = await getNeonDatabase()
			.update(frqQuestions)
			.set({ active: false })
			.where(and(...buildConditions(frqQuestions)))
			.returning({ questionId: frqQuestions.questionId });
		retired += result.length;
		console.log(`✓ Retired ${result.length} FRQ row(s).`);
	}
	console.log(
		`✓ Done. Retired ${retired} active pool row(s) across ${affectedBuckets.size} bucket(s).`
	);
}

main().catch((err) => {
	console.error('Script failed:', err);
	process.exitCode = 1;
});
