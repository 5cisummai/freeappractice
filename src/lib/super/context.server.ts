import { and, desc, eq } from 'drizzle-orm';
import { getFrqAttemptForUser } from '$lib/frq/attempts.server';
import { getFrqQuestionById } from '$lib/frq/question.server';
import type { FrqAttemptView, FrqQuestion } from '$lib/frq/types';
import {
	getQuestionById,
	getQuestionsByIds,
	type StoredQuestion
} from '$lib/questions/storage.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { mcqAttempts } from '$lib/server/neon/schema';
import { buildTutorPersonalization } from '$lib/tutor/personalization.server';
import type { SuperAgentContext } from '$lib/super/coach.server';

export type CurrentSuperQuestion =
	| { kind: 'mcq'; question: StoredQuestion }
	| { kind: 'frq'; question: FrqQuestion; attempt: FrqAttemptView | null };

export type SuperAgentContextResult = {
	text: string;
	memoryDegraded: boolean;
	currentQuestion: CurrentSuperQuestion | null;
};

async function resolveCurrentQuestion(
	userId: string,
	context: SuperAgentContext | undefined
): Promise<CurrentSuperQuestion | null> {
	const questionId = context?.questionId?.trim();
	if (!questionId) return null;
	const questionType = context?.questionType;
	const frqAttemptId = context?.frqAttemptId;
	if (questionType === 'frq') {
		const question = await getFrqQuestionById(questionId);
		const attempt = frqAttemptId ? await getFrqAttemptForUser(userId, frqAttemptId) : null;
		if (attempt && attempt.questionId !== questionId) {
			throw new Error('FRQ attempt does not belong to the current question');
		}
		return { kind: 'frq', question, attempt };
	}
	return { kind: 'mcq', question: await getQuestionById(questionId) };
}

export async function getCurrentSuperQuestion(
	userId: string,
	context: SuperAgentContext | undefined
): Promise<CurrentSuperQuestion | null> {
	return resolveCurrentQuestion(userId, context);
}

export async function getRecentSuperMistakes(
	userId: string,
	filter: { apClass?: string; unit?: string } = {}
) {
	const db = getNeonDatabase();
	const className = filter.apClass;
	const unit = filter.unit;
	const attempts = await db
		.select({
			id: mcqAttempts.id,
			questionId: mcqAttempts.questionId,
			apClass: mcqAttempts.apClass,
			unit: mcqAttempts.unit,
			selectedAnswer: mcqAttempts.selectedAnswer,
			wasCorrect: mcqAttempts.wasCorrect,
			attemptedAt: mcqAttempts.attemptedAt
		})
		.from(mcqAttempts)
		.where(
			and(
				eq(mcqAttempts.userId, userId),
				eq(mcqAttempts.wasCorrect, false),
				className ? eq(mcqAttempts.apClass, className) : undefined,
				unit ? eq(mcqAttempts.unit, unit) : undefined
			)
		)
		.orderBy(desc(mcqAttempts.attemptedAt), desc(mcqAttempts.id))
		.limit(8);
	const questions = await getQuestionsByIds(attempts.map((attempt) => attempt.questionId));
	const questionById = new Map(questions.map((question) => [question.id, question]));
	return attempts.map((attempt) => ({
		questionId: attempt.questionId,
		apClass: attempt.apClass,
		unit: attempt.unit,
		selectedAnswer: attempt.selectedAnswer,
		attemptedAt: attempt.attemptedAt.toISOString(),
		topic: questionById.get(attempt.questionId)?.topicsCovered ?? null,
		question: questionById.get(attempt.questionId)?.question.slice(0, 1_200) ?? null,
		explanation: questionById.get(attempt.questionId)?.explanation.slice(0, 1_200) ?? null
	}));
}

function questionText(current: CurrentSuperQuestion | null): string {
	if (!current) return '';
	if (current.kind === 'mcq') {
		const { question } = current;
		return [
			`Current MCQ (${question.apClass ?? 'AP Course'} · ${question.unit ?? 'N/A'}):`,
			`Question: ${question.question}`,
			`A. ${question.optionA}`,
			`B. ${question.optionB}`,
			`C. ${question.optionC}`,
			`D. ${question.optionD}`,
			`Correct answer and explanation are server-owned: ${question.correctAnswer} — ${question.explanation}`,
			question.topicsCovered ? `Topic: ${question.topicsCovered}` : ''
		]
			.filter(Boolean)
			.join('\n');
	}
	const { question, attempt } = current;
	return [
		`Current FRQ (${question.apClass} · ${question.unit}):`,
		`Prompt: ${question.prompt}`,
		question.materials.length
			? `Materials:\n${question.materials.map((material) => `${material.title ?? 'Material'}: ${material.content}`).join('\n')}`
			: '',
		`Sections:\n${question.sections.map((section) => `${section.label}: ${section.prompt}`).join('\n')}`,
		attempt
			? `Current graded attempt feedback:\n${attempt.grade.criteria.map((criterion) => `${criterion.label}: ${criterion.points}/${criterion.pointsAvailable} — ${criterion.feedback}`).join('\n')}\nOverall: ${attempt.grade.overallFeedback}`
			: 'The student has not submitted this FRQ yet.'
	]
		.filter(Boolean)
		.join('\n');
}

export async function buildSuperAgentContext(
	userId: string,
	query: string,
	context?: SuperAgentContext
): Promise<SuperAgentContextResult> {
	const currentQuestion = await resolveCurrentQuestion(userId, context);
	const [personalization, mistakes] = await Promise.all([
		buildTutorPersonalization(userId, query),
		getRecentSuperMistakes(userId, {
			...(typeof currentQuestion?.question.apClass === 'string'
				? { apClass: currentQuestion.question.apClass }
				: {}),
			...(typeof currentQuestion?.question.unit === 'string'
				? { unit: currentQuestion.question.unit }
				: {})
		})
	]);

	const parts = [
		personalization.context,
		context?.page ? `Current app page: ${context.page}.` : '',
		questionText(currentQuestion),
		mistakes.length
			? `Recent relevant mistakes:\n${mistakes.map((mistake) => `${mistake.apClass} ${mistake.unit} ${mistake.questionId} (${mistake.attemptedAt}) topic=${mistake.topic ?? 'unknown'} selected=${mistake.selectedAnswer ?? 'none'}\n${mistake.question ?? ''}\nExplanation: ${mistake.explanation ?? ''}`).join('\n')}`
			: ''
	].filter(Boolean);

	return {
		text: parts.join('\n\n'),
		memoryDegraded: personalization.memoryDegraded,
		currentQuestion
	};
}
