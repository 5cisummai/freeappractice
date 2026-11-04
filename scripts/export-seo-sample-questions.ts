/**
 * Snapshot 3–5 deterministic MCQs per unit practice page from the serving pool.
 *
 * Run when the public sample set should refresh. CI and Vercel builds have no
 * production database, so the JSON is committed and prerendered into HTML.
 *
 *   bun run seo:export-samples
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { getAllPageSlugs, getPageBySlug } from '../src/lib/catalog/practice-pages.ts';
import {
	buildSeoSampleQuestionsSnapshot,
	type SeoSampleQuestionCandidate
} from '../src/lib/seo/sample-questions.ts';

const OUTPUT_PATH = new URL('../src/lib/seo/data/unit-sample-questions.json', import.meta.url);

type SampleRow = {
	question_id: string;
	course: string;
	unit: string;
	question: string;
	option_a: string;
	option_b: string;
	option_c: string;
	option_d: string;
	correct_answer: string;
	explanation: string;
};

function requireDatabaseUrl(): string {
	const url = process.env.DATABASE_URL?.trim();
	if (!url) throw new Error('DATABASE_URL is required');
	if (!/^postgres(?:ql)?:\/\//i.test(url)) {
		throw new Error('DATABASE_URL must be a Neon PostgreSQL connection string');
	}
	return url;
}

function asCandidate(row: SampleRow): SeoSampleQuestionCandidate | null {
	const correct = row.correct_answer.trim().toUpperCase();
	if (correct !== 'A' && correct !== 'B' && correct !== 'C' && correct !== 'D') return null;
	return {
		questionId: row.question_id,
		course: row.course,
		unit: row.unit,
		question: row.question,
		optionA: row.option_a,
		optionB: row.option_b,
		optionC: row.option_c,
		optionD: row.option_d,
		correctAnswer: correct,
		explanation: row.explanation,
		hasDiagram: false,
		stimulus: null
	};
}

const sql = neon(requireDatabaseUrl());

const rows = (await sql`
	WITH eligible AS (
		SELECT
			q.question_id,
			COALESCE(NULLIF(q.data->>'course', ''), 'Unknown') AS course,
			COALESCE(NULLIF(q.data->>'unit', ''), 'all-units') AS unit,
			COALESCE(q.data->>'question', q.data->>'prompt', '') AS question,
			COALESCE(
				q.data->>'optionA',
				q.data->'options'->0->>'text',
				q.data->'options'->0->>'value',
				q.data->'options'->>0,
				''
			) AS option_a,
			COALESCE(
				q.data->>'optionB',
				q.data->'options'->1->>'text',
				q.data->'options'->1->>'value',
				q.data->'options'->>1,
				''
			) AS option_b,
			COALESCE(
				q.data->>'optionC',
				q.data->'options'->2->>'text',
				q.data->'options'->2->>'value',
				q.data->'options'->>2,
				''
			) AS option_c,
			COALESCE(
				q.data->>'optionD',
				q.data->'options'->3->>'text',
				q.data->'options'->3->>'value',
				q.data->'options'->>3,
				''
			) AS option_d,
			COALESCE(q.data->>'correctAnswer', q.data->>'answer', '') AS correct_answer,
			COALESCE(q.data->>'explanation', q.data->>'rationale', '') AS explanation,
			ROW_NUMBER() OVER (
				PARTITION BY q.data->>'course', q.data->>'unit'
				ORDER BY q.question_id
			) AS rn
		FROM content.mcq_questions q
		WHERE q.active = true
			AND NOT EXISTS (
				SELECT 1
				FROM content.question_quality own_quality
				WHERE own_quality.question_id = q.question_id
					AND own_quality.final_verdict = 'bad'
			)
			AND (
				q.data->>'stimulusId' IS NULL
				OR NOT EXISTS (
					SELECT 1
					FROM content.question_quality shared_quality
					JOIN content.mcq_questions shared_question
						ON shared_question.question_id = shared_quality.question_id
					WHERE shared_quality.final_verdict = 'bad'
						AND COALESCE(
							shared_quality.ai_assessment->>'failure_scope',
							shared_quality.ai_assessment->>'failureScope'
						) IN ('stimulus', 'set')
						AND shared_question.data->>'stimulusId' = q.data->>'stimulusId'
				)
			)
			AND NOT (
				COALESCE(jsonb_typeof(q.data->'stimulus') = 'object', false)
				OR COALESCE(jsonb_typeof(q.data->'diagramSpec') = 'object', false)
				OR COALESCE(q.data->>'hasDiagram' = 'true', false)
			)
	)
	SELECT
		question_id,
		course,
		unit,
		question,
		option_a,
		option_b,
		option_c,
		option_d,
		correct_answer,
		explanation
	FROM eligible
	WHERE rn <= 12
	ORDER BY course, unit, question_id
`) as SampleRow[];

const pages = getAllPageSlugs()
	.map((slug) => getPageBySlug(slug))
	.filter((page): page is NonNullable<typeof page> => page !== null);

const candidates = rows
	.map(asCandidate)
	.filter((candidate): candidate is SeoSampleQuestionCandidate => candidate !== null);
const snapshot = buildSeoSampleQuestionsSnapshot(candidates, pages);
writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, '\t')}\n`);

const unitPages = pages.filter((page) => page.type === 'unit').length;
const withSamples = Object.keys(snapshot.questionsBySlug).length;
const questionCount = Object.values(snapshot.questionsBySlug).reduce(
	(total, questions) => total + questions.length,
	0
);

console.log(
	`Wrote ${questionCount} sample questions for ${withSamples}/${unitPages} unit pages to ${OUTPUT_PATH.pathname}`
);
