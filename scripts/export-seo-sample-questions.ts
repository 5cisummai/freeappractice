/**
 * Select 3–5 deterministic MCQ IDs per unit practice page from the serving pool.
 *
 * Run when the public sample set should refresh. The committed JSON stores IDs.
 * Unit pages load the current text and serving status from Neon at request time.
 *
 *   bun run seo:export-samples
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { getAllPageSlugs, getPageBySlug } from '../src/lib/catalog/practice-pages.ts';
import {
	buildSeoSampleQuestionsSnapshot,
	parseSeoSampleQuestionCandidate,
	type SeoSampleQuestionCandidate
} from '../src/lib/seo/sample-questions.ts';

const OUTPUT_PATH = new URL('../src/lib/seo/data/unit-sample-questions.json', import.meta.url);

type SampleRow = { question_id: string; data: unknown };

function requireDatabaseUrl(): string {
	const url = process.env.DATABASE_URL?.trim();
	if (!url) throw new Error('DATABASE_URL is required');
	if (!/^postgres(?:ql)?:\/\//i.test(url)) {
		throw new Error('DATABASE_URL must be a Neon PostgreSQL connection string');
	}
	return url;
}

const sql = neon(requireDatabaseUrl());

const rows = (await sql`
	WITH eligible AS (
		SELECT
			q.question_id,
			q.data,
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
			AND q.data->>'stimulusId' IS NULL
			AND NOT (
				COALESCE(jsonb_typeof(q.data->'stimulus') IN ('object', 'string'), false)
				OR COALESCE(jsonb_typeof(q.data->'diagramSpec') = 'object', false)
				OR COALESCE(jsonb_typeof(q.data->'diagram') = 'object', false)
				OR COALESCE(q.data->>'hasDiagram' = 'true', false)
				OR NULLIF(BTRIM(q.data->>'passage'), '') IS NOT NULL
				OR NULLIF(BTRIM(q.data->>'context'), '') IS NOT NULL
			)
	)
	SELECT question_id, data
	FROM eligible
	WHERE rn <= 12
	ORDER BY question_id
`) as SampleRow[];

const pages = getAllPageSlugs()
	.map((slug) => getPageBySlug(slug))
	.filter((page): page is NonNullable<typeof page> => page !== null);

const candidates = rows
	.map(({ question_id, data }) => parseSeoSampleQuestionCandidate(question_id, data))
	.filter((candidate): candidate is SeoSampleQuestionCandidate => candidate !== null);
const snapshot = buildSeoSampleQuestionsSnapshot(candidates, pages);

const unitPages = pages.filter((page) => page.type === 'unit');
const incomplete = unitPages.filter((page) => (snapshot[page.slug]?.length ?? 0) < 3);
if (incomplete.length > 0) {
	throw new Error(
		`Fewer than three eligible samples for: ${incomplete.map((page) => page.slug).join(', ')}`
	);
}
writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, '\t')}\n`);

const questionCount = Object.values(snapshot).reduce(
	(total, questions) => total + questions.length,
	0
);

console.log(
	`Wrote ${questionCount} sample questions for ${unitPages.length} unit pages to ${OUTPUT_PATH.pathname}`
);
