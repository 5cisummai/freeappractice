import { getQuestionsLookupMap } from '$lib/question-bank/mcq/repository.server';

const ANSWER_CHOICES = new Set(['A', 'B', 'C', 'D']);
const MAX_GRADE_ATTEMPTS = 50;
const MAX_QUESTION_ID_LENGTH = 80;

export type McqGradeResult = {
	questionId: string;
	selectedAnswer: 'A' | 'B' | 'C' | 'D';
	isCorrect: boolean;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
};

export type GradeMcqAttemptsResult =
	| { status: 200; body: { results: McqGradeResult[] } }
	| { status: 400 | 404; body: { error: string } };

function normalizeAnswerLetter(value: unknown): 'A' | 'B' | 'C' | 'D' | null {
	if (typeof value !== 'string') return null;
	const letter = value.trim().toUpperCase();
	return ANSWER_CHOICES.has(letter) ? (letter as 'A' | 'B' | 'C' | 'D') : null;
}

/** Return the key and explanation only for answers the student just submitted. */
export async function gradeSubmittedMcqAttempts(body: unknown): Promise<GradeMcqAttemptsResult> {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return { status: 400, body: { error: 'A list of attempts is required' } };
	}

	const attempts = (body as { attempts?: unknown }).attempts;
	if (!Array.isArray(attempts) || attempts.length < 1 || attempts.length > MAX_GRADE_ATTEMPTS) {
		return {
			status: 400,
			body: { error: `attempts must contain 1 to ${MAX_GRADE_ATTEMPTS} answers` }
		};
	}

	const parsed: Array<{ questionId: string; selectedAnswer: 'A' | 'B' | 'C' | 'D' }> = [];
	for (const attempt of attempts) {
		if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) {
			return { status: 400, body: { error: 'Each attempt needs a questionId and selectedAnswer' } };
		}
		const record = attempt as Record<string, unknown>;
		const questionId = typeof record.questionId === 'string' ? record.questionId.trim() : '';
		const selectedAnswer = normalizeAnswerLetter(record.selectedAnswer);
		if (!questionId || questionId.length > MAX_QUESTION_ID_LENGTH || !selectedAnswer) {
			return { status: 400, body: { error: 'Each attempt needs a questionId and selectedAnswer' } };
		}
		parsed.push({ questionId, selectedAnswer });
	}

	const questions = await getQuestionsLookupMap(parsed.map((attempt) => attempt.questionId));
	if (parsed.some((attempt) => !questions.has(attempt.questionId))) {
		return { status: 404, body: { error: 'Question not found' } };
	}

	return {
		status: 200,
		body: {
			results: parsed.map((attempt) => {
				const question = questions.get(attempt.questionId);
				if (!question) {
					throw new Error('Graded question disappeared after lookup');
				}
				return {
					questionId: attempt.questionId,
					selectedAnswer: attempt.selectedAnswer,
					isCorrect: attempt.selectedAnswer === question.correctAnswer,
					correctAnswer: question.correctAnswer,
					explanation: question.explanation
				};
			})
		}
	};
}
