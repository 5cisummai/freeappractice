/**
 * Retire active pool rows whose quality verdict is already finalized as bad.
 * Idempotent — safe to re-run from CI after `db:apply`.
 *
 *   bun run db:backfill-retire-bad-quality
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const sql = neon(databaseUrl);

type Counts = {
	bad_quality: number;
	bad_mcq_active: number;
	bad_frq_active: number;
};

async function countBadActive(): Promise<Counts> {
	const [row] = await sql.query(`
		SELECT
			(SELECT COUNT(*)::int FROM content.question_quality WHERE final_verdict = 'bad') AS bad_quality,
			(
				SELECT COUNT(*)::int
				FROM content.mcq_questions m
				JOIN content.question_quality q ON q.question_id = m.question_id
				WHERE q.final_verdict = 'bad' AND m.active = true
			) AS bad_mcq_active,
			(
				SELECT COUNT(*)::int
				FROM content.frq_questions f
				JOIN content.question_quality q ON q.question_id = f.question_id
				WHERE q.final_verdict = 'bad' AND f.active = true
			) AS bad_frq_active
	`);
	return row as Counts;
}

export async function backfillRetireBadQualityQuestions(): Promise<void> {
	const before = await countBadActive();
	console.log('Before:', before);

	await sql.transaction([
		sql.query(`
			UPDATE content.mcq_questions AS m
			SET active = false, updated_at = NOW()
			WHERE m.active = true
			  AND EXISTS (
				SELECT 1
				FROM content.question_quality q
				WHERE q.question_id = m.question_id
				  AND q.final_verdict = 'bad'
			  )
		`),
		sql.query(`
			UPDATE content.mcq_questions AS sibling
			SET active = false, updated_at = NOW()
			WHERE sibling.active = true
			  AND nullif(btrim(sibling.data->>'stimulusId'), '') IS NOT NULL
			  AND EXISTS (
				SELECT 1
				FROM content.mcq_questions target
				JOIN content.question_quality q
				  ON q.question_id = target.question_id
				WHERE q.final_verdict = 'bad'
				  AND coalesce(
					q.ai_assessment->>'failure_scope',
					q.ai_assessment->>'failureScope'
				  ) IN ('stimulus', 'set')
				  AND nullif(btrim(target.data->>'stimulusId'), '') IS NOT NULL
				  AND sibling.data->>'stimulusId' = target.data->>'stimulusId'
			  )
		`),
		sql.query(`
			UPDATE content.frq_questions AS f
			SET active = false, updated_at = NOW()
			WHERE f.active = true
			  AND EXISTS (
				SELECT 1
				FROM content.question_quality q
				WHERE q.question_id = f.question_id
				  AND q.final_verdict = 'bad'
			  )
		`)
	]);

	const after = await countBadActive();
	console.log('After:', after);

	if (after.bad_mcq_active !== 0 || after.bad_frq_active !== 0) {
		throw new Error(
			`Backfill incomplete: bad_mcq_active=${after.bad_mcq_active} bad_frq_active=${after.bad_frq_active}`
		);
	}

	console.log('Bad-quality serving-pool retirement complete.');
}

if (import.meta.main) {
	void backfillRetireBadQualityQuestions().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
