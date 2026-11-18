import { describe, expect, it } from 'vitest';
import { QuestionRequestError } from '#lib/client/activation-analytics.js';
import {
	classifyQuizStartFailure,
	quizStartFailedProperties,
	quizStartedProperties
} from '#lib/question-bank/mcq/quiz-start-failure.js';
import { PoolWarmingError, QuizStartError } from '#lib/question-bank/request.client.js';

describe('classifyQuizStartFailure', () => {
	it.each([
		{
			error: new QuizStartError('follow-up empty', 400, 'FOLLOW_UP_EMPTY', 0),
			reason: 'follow_up_empty',
			retryable: false
		},
		{
			error: new QuizStartError('short pool', 400, 'INSUFFICIENT_QUESTIONS', 4),
			reason: 'insufficient_questions',
			retryable: true
		},
		{
			error: new PoolWarmingError('warming', 20),
			reason: 'pool_warming',
			retryable: true
		},
		{
			error: new PoolWarmingError(
				'No follow-up questions are available from the missed units right now.',
				20
			),
			reason: 'follow_up_empty',
			retryable: false
		},
		{
			error: new QuestionRequestError('Failed to load quiz.', 500),
			reason: 'request_failed',
			retryable: true
		},
		{
			error: new Error('Quiz service returned a question without an answer key.'),
			reason: 'missing_answer_key',
			retryable: true
		}
	])('classifies $reason', ({ error, reason, retryable }) => {
		expect(classifyQuizStartFailure(error)).toMatchObject({ reason, retryable });
	});
});

describe('quiz start analytics properties', () => {
	it('includes requested vs available counts on failure', () => {
		expect(
			quizStartFailedProperties({
				course: 'AP Biology',
				unit: 'Unit 1',
				requestedCount: 20,
				focusMode: false,
				failure: classifyQuizStartFailure(
					new QuizStartError('short pool', 400, 'INSUFFICIENT_QUESTIONS', 7)
				)
			})
		).toMatchObject({
			course: 'AP Biology',
			unit: 'Unit 1',
			requested_count: 20,
			available_count: 7,
			focus_mode: false,
			error_code: 'INSUFFICIENT_QUESTIONS',
			reason: 'insufficient_questions'
		});
	});

	it('marks truncated starts when the served count is smaller', () => {
		expect(
			quizStartedProperties({
				course: 'AP World History',
				unit: 'Unit 2',
				requestedCount: 25,
				selectedCount: 12,
				focusMode: false
			})
		).toMatchObject({
			requested_count: 25,
			selected_count: 12,
			truncated: true
		});
	});
});
