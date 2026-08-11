import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { getQuestionsLookupMap } from '$lib/questions/storage.server';
import { sanitizeAttemptTimeMs } from '$lib/users/attempt-time';
import { quizAttemptQuestions, quizAttempts } from '$lib/server/neon/schema';

const MAX_QUIZ_COUNT = 50;
const MAX_QUIZ_DURATION_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANSWER_LETTERS = new Set(['A', 'B', 'C', 'D']);

type QuizAttemptInput = {
	quizId?: unknown;
	apClass?: unknown;
	unit?: unknown;
	startedAt?: unknown;
	items?: unknown;
};

type QuizQuestionInput = {
	position: number;
	questionId: string;
	selectedAnswer: 'A' | 'B' | 'C' | 'D' | null;
	timeTakenMs: number | null;
};

export type PersistQuizAttemptResult =
	| {
			status: 200;
			body: {
				message: string;
				quizId: string;
				requestedCount: number;
				answeredCount: number;
				correctCount: number;
				scorePercent: number;
			};
	  }
	| { status: 400 | 404 | 422; body: { error: string } };

export type CoachQuizAttempt = {
	quizId: string;
	apClass: string;
	unit: string;
	requestedCount: number;
	answeredCount: number;
	correctCount: number;
	incorrectCount: number;
	scorePercent: number;
	questions: Array<{
		position: number;
		questionId: string;
		prompt: string | null;
		options: Record<string, string> | null;
		selectedAnswer: string | null;
		correctAnswer: string | null;
		wasCorrect: boolean | null;
		explanation: string | null;
	}>;
};

function asTrimmedString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function parseStartedAt(value: unknown, fallback: Date): Date {
	if (typeof value !== 'string') return fallback;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime()) || parsed.getTime() > fallback.getTime()) return fallback;
	return parsed;
}

function parseAnswer(value: unknown): QuizQuestionInput['selectedAnswer'] | undefined {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value !== 'string') return undefined;
	const answer = value.trim().toUpperCase();
	return ANSWER_LETTERS.has(answer) ? (answer as QuizQuestionInput['selectedAnswer']) : undefined;
}

function parseQuizQuestions(value: unknown): QuizQuestionInput[] | null {
	if (!Array.isArray(value) || value.length < 1 || value.length > MAX_QUIZ_COUNT) return null;

	const positions = new Set<number>();
	const items: QuizQuestionInput[] = [];
	for (const rawItem of value) {
		if (!rawItem || typeof rawItem !== 'object') return null;
		const item = rawItem as Record<string, unknown>;
		const position = item.position;
		const questionId = asTrimmedString(item.questionId);
		const selectedAnswer = parseAnswer(item.selectedAnswer);
		if (
			typeof position !== 'number' ||
			!Number.isInteger(position) ||
			position < 0 ||
			position >= value.length ||
			positions.has(position) ||
			!questionId ||
			selectedAnswer === undefined
		) {
			return null;
		}
		positions.add(position);
		items.push({
			position,
			questionId,
			selectedAnswer,
			timeTakenMs:
				item.timeTakenMs === null || item.timeTakenMs === undefined
					? null
					: sanitizeAttemptTimeMs(item.timeTakenMs)
		});
	}

	return items.sort((a, b) => a.position - b.position);
}

/** Persist one completed client-side quiz and verify each answer against canonical questions. */
export async function persistQuizAttempt(
	userId: string,
	body: Record<string, unknown>
): Promise<PersistQuizAttemptResult> {
	const input = body as QuizAttemptInput;
	const apClass = asTrimmedString(input.apClass);
	const unit = asTrimmedString(input.unit) || 'All Units';
	const quizId = asTrimmedString(input.quizId);
	const items = parseQuizQuestions(input.items);

	if (!apClass || apClass.length > 120 || unit.length > 120) {
		return { status: 400, body: { error: 'A valid class and unit are required.' } };
	}
	if (quizId && !UUID_PATTERN.test(quizId)) {
		return { status: 400, body: { error: 'Invalid quiz ID.' } };
	}
	if (!items) {
		return { status: 400, body: { error: 'A quiz must include between 1 and 50 questions.' } };
	}

	const questionMap = await getQuestionsLookupMap(items.map((item) => item.questionId));
	const missingQuestion = items.find((item) => !questionMap.has(item.questionId));
	if (missingQuestion) {
		return {
			status: 404,
			body: { error: 'One or more quiz questions are no longer available.' }
		};
	}

	const completedAt = new Date();
	const startedAt = parseStartedAt(input.startedAt, completedAt);
	const answeredCount = items.filter((item) => item.selectedAnswer !== null).length;
	const correctCount = items.filter((item) => {
		const question = questionMap.get(item.questionId);
		return item.selectedAnswer !== null && item.selectedAnswer === question?.correctAnswer;
	}).length;
	const incorrectCount = answeredCount - correctCount;
	const scorePercent = Math.round((correctCount / items.length) * 100);
	const elapsedMs = Math.min(
		MAX_QUIZ_DURATION_MS,
		Math.max(0, completedAt.getTime() - startedAt.getTime())
	);
	const persistedQuizId = quizId || randomUUID();
	const db = getNeonDatabase();

	const quizInsert = db
		.insert(quizAttempts)
		.values({
			id: persistedQuizId,
			userId,
			apClass,
			unit,
			requestedCount: items.length,
			answeredCount,
			correctCount,
			incorrectCount,
			scorePercent,
			timeTakenMs: elapsedMs,
			startedAt,
			completedAt
		})
		.onConflictDoNothing();
	const questionInsert = db
		.insert(quizAttemptQuestions)
		.values(
			items.map((item) => ({
				quizAttemptId: persistedQuizId,
				position: item.position,
				questionId: item.questionId,
				selectedAnswer: item.selectedAnswer,
				wasCorrect:
					item.selectedAnswer === null
						? null
						: item.selectedAnswer === questionMap.get(item.questionId)?.correctAnswer,
				timeTakenMs: item.timeTakenMs
			}))
		)
		.onConflictDoNothing();

	await db.batch([quizInsert, questionInsert]);
	return {
		status: 200,
		body: {
			message: 'Quiz saved to history.',
			quizId: persistedQuizId,
			requestedCount: items.length,
			answeredCount,
			correctCount,
			scorePercent
		}
	};
}

/** Return one of the signed-in user's completed quizzes for Coach review. */
export async function getQuizAttemptForCoach(
	userId: string,
	quizId: string,
	questionPositions?: number[]
): Promise<CoachQuizAttempt | null> {
	const db = getNeonDatabase();
	const [summary] = await db
		.select({
			id: quizAttempts.id,
			apClass: quizAttempts.apClass,
			unit: quizAttempts.unit,
			requestedCount: quizAttempts.requestedCount,
			answeredCount: quizAttempts.answeredCount,
			correctCount: quizAttempts.correctCount,
			incorrectCount: quizAttempts.incorrectCount,
			scorePercent: quizAttempts.scorePercent
		})
		.from(quizAttempts)
		.where(and(eq(quizAttempts.id, quizId), eq(quizAttempts.userId, userId)))
		.limit(1);
	if (!summary) return null;

	const items = await db
		.select({
			position: quizAttemptQuestions.position,
			questionId: quizAttemptQuestions.questionId,
			selectedAnswer: quizAttemptQuestions.selectedAnswer,
			wasCorrect: quizAttemptQuestions.wasCorrect
		})
		.from(quizAttemptQuestions)
		.where(eq(quizAttemptQuestions.quizAttemptId, quizId))
		.orderBy(asc(quizAttemptQuestions.position));
	const questionMap = await getQuestionsLookupMap(items.map((item) => item.questionId));
	const requestedPositions = questionPositions?.length ? new Set(questionPositions) : null;
	const reviewItems = requestedPositions
		? items.filter((item) => requestedPositions.has(item.position + 1))
		: items.filter((item) => item.wasCorrect !== true).slice(0, 20);

	return {
		quizId: summary.id,
		apClass: summary.apClass,
		unit: summary.unit,
		requestedCount: summary.requestedCount,
		answeredCount: summary.answeredCount,
		correctCount: summary.correctCount,
		incorrectCount: summary.incorrectCount,
		scorePercent: summary.scorePercent,
		questions: reviewItems.map((item) => {
			const question = questionMap.get(item.questionId);
			return {
				position: item.position + 1,
				questionId: item.questionId,
				prompt: question?.question.slice(0, 1800) ?? null,
				options: question
					? {
							A: question.optionA.slice(0, 900),
							B: question.optionB.slice(0, 900),
							C: question.optionC.slice(0, 900),
							D: question.optionD.slice(0, 900)
						}
					: null,
				selectedAnswer: item.selectedAnswer,
				correctAnswer: question?.correctAnswer ?? null,
				wasCorrect: item.wasCorrect,
				explanation: question?.explanation.slice(0, 1800) ?? null
			};
		})
	};
}
