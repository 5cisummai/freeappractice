import { QuestionRequestError } from '#lib/client/activation-analytics.js';
import {
	FOLLOW_UP_EMPTY_CODE,
	INSUFFICIENT_QUESTIONS_CODE,
	POOL_WARMING_CODE
} from '#lib/question-bank/mcq/payload.js';
import { PoolWarmingError, QuizStartError } from '#lib/question-bank/request.client.js';

export type QuizStartFailureReason =
	| 'insufficient_questions'
	| 'pool_warming'
	| 'follow_up_empty'
	| 'request_failed'
	| 'missing_answer_key'
	| 'missing_course'
	| 'unknown';

export type QuizStartFailure = {
	reason: QuizStartFailureReason;
	errorCode: string;
	message: string;
	availableCount: number | null;
	retryable: boolean;
	status: number | null;
};

const FOLLOW_UP_EMPTY_MESSAGE =
	'No follow-up questions are available from the missed units right now.';

function failure(input: QuizStartFailure): QuizStartFailure {
	return input;
}

function messageOf(error: unknown, fallback: string): string {
	return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function classifyQuizStartFailure(error: unknown): QuizStartFailure {
	if (error instanceof QuizStartError) {
		switch (error.code) {
			case FOLLOW_UP_EMPTY_CODE:
				return failure({
					reason: 'follow_up_empty',
					errorCode: error.code,
					message: error.message || FOLLOW_UP_EMPTY_MESSAGE,
					availableCount: error.availableCount,
					retryable: false,
					status: error.status
				});
			case INSUFFICIENT_QUESTIONS_CODE:
				return failure({
					reason: 'insufficient_questions',
					errorCode: error.code,
					message: error.message,
					availableCount: error.availableCount,
					retryable: Boolean(error.availableCount && error.availableCount > 0),
					status: error.status
				});
			case POOL_WARMING_CODE:
				return failure({
					reason: 'pool_warming',
					errorCode: error.code,
					message: error.message,
					availableCount: error.availableCount,
					retryable: true,
					status: error.status
				});
			default:
				return failure({
					reason: 'request_failed',
					errorCode: error.code || 'request_failed',
					message: error.message,
					availableCount: error.availableCount,
					retryable: true,
					status: error.status
				});
		}
	}

	if (error instanceof PoolWarmingError) {
		const followUp = error.message.includes('follow-up questions');
		return failure({
			reason: followUp ? 'follow_up_empty' : 'pool_warming',
			errorCode: followUp ? FOLLOW_UP_EMPTY_CODE : POOL_WARMING_CODE,
			message: error.message,
			availableCount: null,
			retryable: !followUp,
			status: error.status
		});
	}

	if (error instanceof QuestionRequestError) {
		return failure({
			reason: 'request_failed',
			errorCode: error.failureKind,
			message: error.message,
			availableCount: null,
			retryable: true,
			status: error.status
		});
	}

	const message = messageOf(error, 'Could not start this quiz.');
	if (message.includes('follow-up questions')) {
		return failure({
			reason: 'follow_up_empty',
			errorCode: FOLLOW_UP_EMPTY_CODE,
			message,
			availableCount: 0,
			retryable: false,
			status: null
		});
	}
	if (message.includes('Not enough active questions')) {
		return failure({
			reason: 'insufficient_questions',
			errorCode: INSUFFICIENT_QUESTIONS_CODE,
			message,
			availableCount: null,
			retryable: false,
			status: null
		});
	}
	if (message.includes('answer key')) {
		return failure({
			reason: 'missing_answer_key',
			errorCode: 'MISSING_ANSWER_KEY',
			message,
			availableCount: null,
			retryable: true,
			status: null
		});
	}
	return failure({
		reason: 'unknown',
		errorCode: 'UNKNOWN',
		message,
		availableCount: null,
		retryable: true,
		status: null
	});
}

export function quizStartFailedProperties(input: {
	course: string;
	unit: string;
	requestedCount: number;
	focusMode: boolean;
	failure: QuizStartFailure;
}): Record<string, unknown> {
	return {
		course: input.course,
		unit: input.unit,
		requested_count: input.requestedCount,
		available_count: input.failure.availableCount,
		focus_mode: input.focusMode,
		error_code: input.failure.errorCode,
		reason: input.failure.reason,
		error_message: input.failure.message
	};
}

export function quizStartedProperties(input: {
	course: string;
	unit: string;
	requestedCount: number;
	selectedCount: number;
	focusMode: boolean;
}): Record<string, unknown> {
	return {
		course: input.course,
		unit: input.unit,
		requested_count: input.requestedCount,
		selected_count: input.selectedCount,
		focus_mode: input.focusMode,
		truncated: input.selectedCount < input.requestedCount
	};
}
