/**
 * Shuffle MCQ option order for rows that still have LLM A-bias (optionsShuffled ≠ true).
 * Idempotent — safe to re-run from CI after `db:apply`.
 *
 *   bun run db:backfill-mcq-option-shuffle
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import {
	hasShuffledMcqOptions,
	OPTIONS_SHUFFLED_FLAG,
	shuffleMcqOptions,
	type McqOptionLetter
} from '../src/lib/question-bank/mcq/shuffle-options.ts';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const sql = neon(databaseUrl);

const BATCH_SIZE = 200;

type McqRow = {
	question_id: string;
	data: Record<string, unknown>;
};

function asOptionLetter(value: unknown): McqOptionLetter | null {
	if (typeof value !== 'string') return null;
	const upper = value.trim().toUpperCase();
	if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') return upper;
	return null;
}

function shuffleRowData(data: Record<string, unknown>): Record<string, unknown> | null {
	if (hasShuffledMcqOptions(data)) return null;

	const correctAnswer = asOptionLetter(data.correctAnswer ?? data.answer);
	if (!correctAnswer) return null;

	const optionA = typeof data.optionA === 'string' ? data.optionA : '';
	const optionB = typeof data.optionB === 'string' ? data.optionB : '';
	const optionC = typeof data.optionC === 'string' ? data.optionC : '';
	const optionD = typeof data.optionD === 'string' ? data.optionD : '';
	if (!optionA && !optionB && !optionC && !optionD) return null;

	const rawChoices =
		data.choiceExplanations &&
		typeof data.choiceExplanations === 'object' &&
		!Array.isArray(data.choiceExplanations)
			? (data.choiceExplanations as Record<string, unknown>)
			: null;
	const choiceExplanations =
		rawChoices &&
		typeof rawChoices.A === 'string' &&
		typeof rawChoices.B === 'string' &&
		typeof rawChoices.C === 'string' &&
		typeof rawChoices.D === 'string'
			? {
					A: rawChoices.A,
					B: rawChoices.B,
					C: rawChoices.C,
					D: rawChoices.D
				}
			: null;

	const shuffled = shuffleMcqOptions({
		optionA,
		optionB,
		optionC,
		optionD,
		correctAnswer,
		explanation: typeof data.explanation === 'string' ? data.explanation : undefined,
		choiceExplanations
	});

	return {
		...data,
		optionA: shuffled.optionA,
		optionB: shuffled.optionB,
		optionC: shuffled.optionC,
		optionD: shuffled.optionD,
		correctAnswer: shuffled.correctAnswer,
		...(typeof shuffled.explanation === 'string' ? { explanation: shuffled.explanation } : {}),
		...(shuffled.choiceExplanations != null
			? { choiceExplanations: shuffled.choiceExplanations }
			: {}),
		[OPTIONS_SHUFFLED_FLAG]: true
	};
}

async function countPending(): Promise<number> {
	const [row] = await sql.query(`
		SELECT COUNT(*)::int AS count
		FROM content.mcq_questions
		WHERE COALESCE((data->>'${OPTIONS_SHUFFLED_FLAG}')::boolean, false) = false
	`);
	return Number((row as { count: number }).count ?? 0);
}

async function fetchBatch(limit: number): Promise<McqRow[]> {
	const rows = await sql.query(
		`
		SELECT question_id, data
		FROM content.mcq_questions
		WHERE COALESCE((data->>'${OPTIONS_SHUFFLED_FLAG}')::boolean, false) = false
		ORDER BY question_id
		LIMIT $1
	`,
		[limit]
	);
	return rows as McqRow[];
}

export async function backfillMcqOptionShuffle(): Promise<void> {
	const before = await countPending();
	console.log(`Pending MCQ option shuffles: ${before}`);

	let updated = 0;
	let skipped = 0;

	for (;;) {
		const batch = await fetchBatch(BATCH_SIZE);
		if (batch.length === 0) break;

		for (const row of batch) {
			const data =
				row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : null;
			if (!data) {
				skipped += 1;
				continue;
			}

			const next = shuffleRowData(data);
			if (!next) {
				// Mark unscrambleable rows so the job stays idempotent.
				await sql.query(
					`
					UPDATE content.mcq_questions
					SET data = jsonb_set(data, '{${OPTIONS_SHUFFLED_FLAG}}', 'true'::jsonb, true),
					    updated_at = NOW()
					WHERE question_id = $1
					  AND COALESCE((data->>'${OPTIONS_SHUFFLED_FLAG}')::boolean, false) = false
				`,
					[row.question_id]
				);
				skipped += 1;
				continue;
			}

			await sql.query(
				`
				UPDATE content.mcq_questions
				SET data = $2::jsonb,
				    updated_at = NOW()
				WHERE question_id = $1
				  AND COALESCE((data->>'${OPTIONS_SHUFFLED_FLAG}')::boolean, false) = false
			`,
				[row.question_id, JSON.stringify(next)]
			);
			updated += 1;
		}

		if (batch.length < BATCH_SIZE) break;
	}

	const after = await countPending();
	console.log(`Updated: ${updated}; marked-without-shuffle: ${skipped}; remaining: ${after}`);

	if (after !== 0) {
		throw new Error(`Backfill incomplete: ${after} MCQ rows still lack ${OPTIONS_SHUFFLED_FLAG}`);
	}

	console.log('MCQ option shuffle backfill complete.');
}

if (import.meta.main) {
	void backfillMcqOptionShuffle().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
