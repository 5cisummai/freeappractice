import { sql, type SQL } from 'drizzle-orm';
import { frqQuestions, mcqQuestions } from '#lib/server/neon/schema.js';

/**
 * Serving-pool filter: drop finalized-bad questions, and drop stimulus siblings
 * when a shared stimulus/set failure marked another sibling bad.
 */
export function mcqServableQualityPredicate(
	questionIdColumn: typeof mcqQuestions.questionId = mcqQuestions.questionId,
	dataColumn: typeof mcqQuestions.data = mcqQuestions.data
): SQL {
	return sql`not exists (
					select 1
					from content.question_quality own_quality
					where own_quality.question_id = ${questionIdColumn}
					  and own_quality.final_verdict = 'bad'
				)
				and (
					${dataColumn}->>'stimulusId' is null
					or not exists (
						select 1
						from content.question_quality shared_quality
						join content.mcq_questions shared_question
						  on shared_question.question_id = shared_quality.question_id
						where shared_quality.final_verdict = 'bad'
						  and coalesce(
							shared_quality.ai_assessment->>'failure_scope',
							shared_quality.ai_assessment->>'failureScope'
						  ) in ('stimulus', 'set')
						  and shared_question.data->>'stimulusId' = ${dataColumn}->>'stimulusId'
					)
				)`;
}

/** Serving-pool filter: drop finalized-bad FRQ rows. */
export function frqServableQualityPredicate(
	questionIdColumn: typeof frqQuestions.questionId = frqQuestions.questionId
): SQL {
	return sql`not exists (
					select 1
					from content.question_quality q
					where q.question_id = ${questionIdColumn}
					  and q.final_verdict = 'bad'
				)`;
}
