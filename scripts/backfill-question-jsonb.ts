/**
 * Copies the legacy relational question fields into content.*_questions.data.
 *
 * Run after the additive JSONB migration and before the cleanup migration:
 *   bun run db:backfill-question-jsonb
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const sql = neon(databaseUrl);

export async function backfillQuestionJsonb(): Promise<void> {
	const [legacySchema] = await sql.query(`
		SELECT
			EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'content'
					AND table_name = 'mcq_questions'
					AND column_name = 'ap_class'
			) AS has_legacy_columns,
			EXISTS (
				SELECT 1
				FROM information_schema.tables
				WHERE table_schema = 'content'
					AND table_name = 'frq_materials'
			) AS has_frq_children
	`);
	if (!legacySchema.has_legacy_columns && !legacySchema.has_frq_children) {
		console.log('Legacy question columns are already removed; nothing to backfill.');
		return;
	}
	if (!legacySchema.has_legacy_columns || !legacySchema.has_frq_children) {
		throw new Error(
			'Legacy question schema is only partially present; refusing a partial backfill.'
		);
	}

	await sql.transaction([
		sql.query(`
			UPDATE content.mcq_questions
			SET data = jsonb_build_object(
				'apClass', ap_class,
				'unit', unit,
				'topicsCovered', COALESCE(topics_covered, ''),
				'question', question,
				'diagramSpec', diagram_spec,
				'hasDiagram', has_diagram,
				'optionA', option_a,
				'optionB', option_b,
				'optionC', option_c,
				'optionD', option_d,
				'correctAnswer', correct_answer,
				'explanation', explanation,
				'hint1', hint_1,
				'hint2', hint_2
			)
			WHERE data IS NULL
		`),
		sql.query(`
			UPDATE content.frq_questions AS question
			SET data = jsonb_build_object(
				'apClass', question.ap_class,
				'unit', question.unit,
				'formatId', question.format_id,
				'profileVersion', question.profile_version,
				'promptVersion', question.prompt_version,
				'rubricVersion', question.rubric_version,
				'schemaVersion', question.schema_version,
				'prompt', question.prompt,
				'materials', COALESCE((
					SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
						'id', material_id,
						'title', title,
						'content', content
					)) ORDER BY position)
					FROM content.frq_materials
					WHERE question_id = question.question_id
				), '[]'::jsonb),
				'sections', COALESCE((
					SELECT jsonb_agg(jsonb_build_object(
						'id', section_id,
						'label', label,
						'prompt', prompt,
						'responseKind', response_kind,
						'maxPoints', max_points
					) ORDER BY position)
					FROM content.frq_sections
					WHERE question_id = question.question_id
				), '[]'::jsonb),
				'rubric', COALESCE((
					SELECT jsonb_agg(jsonb_build_object(
						'id', criterion.criterion_id,
						'sectionId', criterion.section_id,
						'label', criterion.label,
						'maxPoints', criterion.max_points,
						'referenceAnswer', criterion.reference_answer,
						'levels', COALESCE((
							SELECT jsonb_agg(jsonb_build_object(
								'points', level.points,
								'description', level.description
							) ORDER BY level.position)
							FROM content.frq_rubric_levels AS level
							WHERE level.question_id = criterion.question_id
								AND level.criterion_id = criterion.criterion_id
						), '[]'::jsonb)
					) ORDER BY criterion.position)
					FROM content.frq_rubric_criteria AS criterion
					WHERE criterion.question_id = question.question_id
				), '[]'::jsonb),
				'totalPoints', question.total_points,
				'topicsCovered', question.topics_covered
			)
			WHERE data IS NULL
		`)
	]);

	const [counts] = await sql.query(`
		SELECT
			(SELECT COUNT(*)::int FROM content.mcq_questions WHERE data IS NULL) AS missing_mcq,
			(SELECT COUNT(*)::int FROM content.frq_questions WHERE data IS NULL) AS missing_frq
	`);
	if (counts.missing_mcq !== 0 || counts.missing_frq !== 0) {
		throw new Error(
			`Backfill incomplete: ${counts.missing_mcq} MCQ and ${counts.missing_frq} FRQ payloads missing`
		);
	}

	console.log('Question JSONB backfill complete.');
}

if (import.meta.main) {
	void backfillQuestionJsonb().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
