/**
 * Copy legacy JSONB `apClass` into `course` on MCQ/FRQ question payloads,
 * then drop `apClass` so pool serving (which filters on `data->>'course'`) works.
 *
 *   bun run db:backfill-apclass-to-course
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const sql = neon(databaseUrl);

type CountRow = {
	mcq_missing: number;
	mcq_with_apclass: number;
	frq_missing: number;
	frq_with_apclass: number;
};

async function countLegacyRows(): Promise<CountRow> {
	const [row] = await sql.query(`
		SELECT
			(
				SELECT COUNT(*)::int
				FROM content.mcq_questions
				WHERE data ? 'apClass'
					AND nullif(btrim(COALESCE(data ->> 'course', '')), '') IS NULL
			) AS mcq_missing,
			(
				SELECT COUNT(*)::int
				FROM content.mcq_questions
				WHERE data ? 'apClass'
			) AS mcq_with_apclass,
			(
				SELECT COUNT(*)::int
				FROM content.frq_questions
				WHERE data ? 'apClass'
					AND nullif(btrim(COALESCE(data ->> 'course', '')), '') IS NULL
			) AS frq_missing,
			(
				SELECT COUNT(*)::int
				FROM content.frq_questions
				WHERE data ? 'apClass'
			) AS frq_with_apclass
	`);
	return row as CountRow;
}

async function sampleBucket(
	course: string,
	unit: string
): Promise<{ via_course: number; via_apclass: number }> {
	const [row] = await sql`
		SELECT
			COUNT(*) FILTER (
				WHERE active = true
					AND data ->> 'course' = ${course}
					AND data ->> 'unit' = ${unit}
			)::int AS via_course,
			COUNT(*) FILTER (
				WHERE active = true
					AND data ->> 'apClass' = ${course}
					AND data ->> 'unit' = ${unit}
			)::int AS via_apclass
		FROM content.mcq_questions
	`;
	return row as { via_course: number; via_apclass: number };
}

export async function backfillApClassToCourse(): Promise<void> {
	const before = await countLegacyRows();
	console.log('Before:', before);

	if (
		before.mcq_missing === 0 &&
		before.frq_missing === 0 &&
		before.mcq_with_apclass === 0 &&
		before.frq_with_apclass === 0
	) {
		console.log('Nothing to backfill.');
		return;
	}

	const probeBefore = await sampleBucket('AP Physics 1', 'Unit 1: Kinematics');
	console.log('Probe AP Physics 1 / Unit 1: Kinematics before:', probeBefore);

	await sql.transaction([
		sql.query(`
			UPDATE content.mcq_questions
			SET
				data = (data || jsonb_build_object('course', btrim(data ->> 'apClass'))) - 'apClass',
				updated_at = NOW()
			WHERE data ? 'apClass'
				AND nullif(btrim(COALESCE(data ->> 'course', '')), '') IS NULL
				AND nullif(btrim(COALESCE(data ->> 'apClass', '')), '') IS NOT NULL
		`),
		sql.query(`
			UPDATE content.frq_questions
			SET
				data = (data || jsonb_build_object('course', btrim(data ->> 'apClass'))) - 'apClass',
				updated_at = NOW()
			WHERE data ? 'apClass'
				AND nullif(btrim(COALESCE(data ->> 'course', '')), '') IS NULL
				AND nullif(btrim(COALESCE(data ->> 'apClass', '')), '') IS NOT NULL
		`),
		// Rows that already had course but still carry the legacy key.
		sql.query(`
			UPDATE content.mcq_questions
			SET
				data = data - 'apClass',
				updated_at = NOW()
			WHERE data ? 'apClass'
		`),
		sql.query(`
			UPDATE content.frq_questions
			SET
				data = data - 'apClass',
				updated_at = NOW()
			WHERE data ? 'apClass'
		`)
	]);

	const after = await countLegacyRows();
	console.log('After:', after);

	const probeAfter = await sampleBucket('AP Physics 1', 'Unit 1: Kinematics');
	console.log('Probe AP Physics 1 / Unit 1: Kinematics after:', probeAfter);

	if (
		after.mcq_missing !== 0 ||
		after.frq_missing !== 0 ||
		after.mcq_with_apclass !== 0 ||
		after.frq_with_apclass !== 0
	) {
		throw new Error(
			`Backfill incomplete: mcq_missing=${after.mcq_missing} frq_missing=${after.frq_missing} mcq_with_apclass=${after.mcq_with_apclass} frq_with_apclass=${after.frq_with_apclass}`
		);
	}

	console.log('apClass → course backfill complete.');
}

if (import.meta.main) {
	void backfillApClassToCourse().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
