import { randomUUID } from 'node:crypto';
import { desc, eq, sql } from 'drizzle-orm';
import { QUESTION_QUALITY_MODEL } from '$lib/ai/ai-models-config';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	questionFeedback,
	questionQuality,
	questionRegistry,
	qualityReviewJobs
} from '$lib/server/neon/schema';
import { isDuplicateKeyError } from '$lib/question-bank/util.server';
import { getQuestionById } from '$lib/question-bank/mcq/repository.server';
import { ensureQuestionQuality, type ReviewJobDocument } from './models.server.js';
import { feedbackSummaryFromCounts } from './rules.js';
import type {
	AiQualityAssessment,
	FeedbackSummary,
	FeedbackType,
	QualityDashboardSnapshot,
	QualityJobSummary
} from './types.js';

export function modelName(): string {
	return QUESTION_QUALITY_MODEL;
}

export function toJobSummary(job: Partial<ReviewJobDocument>): QualityJobSummary {
	return {
		id: String(job.id),
		status: job.status as QualityJobSummary['status'],
		selectedCount: Number(job.selectedCount ?? 0),
		queuedCount: Number(job.queuedCount ?? 0),
		submittedCount: Number(job.submittedCount ?? 0),
		awaitingHumanCount: Number(job.awaitingHumanCount ?? 0),
		finalCount: Number(job.finalCount ?? 0),
		failedCount: Number(job.failedCount ?? 0),
		estimatedMaximumCostUsd: Number(job.estimatedMaximumCostUsd ?? 0),
		actualCostUsd: Number(job.actualCostUsd ?? 0),
		model: String(job.model ?? ''),
		createdAt: job.createdAt as Date,
		updatedAt: job.updatedAt as Date,
		error: typeof job.error === 'string' ? job.error : null
	};
}

export async function submitQuestionFeedback(opts: {
	questionId: string;
	userId: string;
	type: FeedbackType;
	apClass?: string;
	unit?: string;
}): Promise<{ accepted: boolean; summary: FeedbackSummary }> {
	const questionId = opts.questionId.trim();
	if (!questionId) throw new Error('Question not found');
	const [{ questionExists }] = await getNeonDatabase()
		.select({ questionExists: sql<number>`count(*)::int` })
		.from(questionRegistry)
		.where(eq(questionRegistry.questionId, questionId));
	if (!questionExists) throw new Error('Question not found');
	let accepted = false;
	try {
		const inserted = await getNeonDatabase()
			.insert(questionFeedback)
			.values({
				id: randomUUID(),
				questionId,
				userId: opts.userId,
				type: opts.type,
				apClass: opts.apClass,
				unit: opts.unit
			})
			.onConflictDoNothing({
				target: [questionFeedback.questionId, questionFeedback.userId, questionFeedback.type]
			})
			.returning({ id: questionFeedback.id });
		accepted = inserted.length > 0;
	} catch (error) {
		if (!isDuplicateKeyError(error)) {
			throw error;
		}
	}
	const db = getNeonDatabase();
	const [aggregates, [{ uniqueReporters }]] = await Promise.all([
		db
			.select({
				type: questionFeedback.type,
				users: sql<number>`count(distinct ${questionFeedback.userId})::int`
			})
			.from(questionFeedback)
			.where(eq(questionFeedback.questionId, questionId))
			.groupBy(questionFeedback.type),
		db
			.select({ uniqueReporters: sql<number>`count(distinct ${questionFeedback.userId})::int` })
			.from(questionFeedback)
			.where(eq(questionFeedback.questionId, questionId))
	]);
	const counts: Partial<Record<FeedbackType, number>> = {};
	for (const aggregate of aggregates) {
		counts[aggregate.type as FeedbackType] = Number(aggregate.users);
	}
	const summary = {
		...feedbackSummaryFromCounts(counts),
		uniqueReporters: Number(uniqueReporters)
	};
	await ensureQuestionQuality(questionId);
	const nextPriority =
		summary.priority === 'high'
			? sql`'high'`
			: sql`case when ${questionQuality.feedbackPriority} = 'high' then 'high' else 'normal' end`;
	await getNeonDatabase()
		.update(questionQuality)
		.set({
			answerIncorrectCount:
				sql`greatest(${questionQuality.answerIncorrectCount}, ${summary.answerIncorrect})` as unknown as number,
			questionUnclearCount:
				sql`greatest(${questionQuality.questionUnclearCount}, ${summary.questionUnclear})` as unknown as number,
			explanationUnclearCount:
				sql`greatest(${questionQuality.explanationUnclearCount}, ${summary.explanationUnclear})` as unknown as number,
			uniqueReporters:
				sql`greatest(${questionQuality.uniqueReporters}, ${summary.uniqueReporters})` as unknown as number,
			...(summary.priority !== 'none'
				? {
						feedbackPriority: nextPriority as unknown as string,
						needsHumanReview: true,
						humanReviewReason:
							summary.priority === 'high' ? 'student_feedback_escalation' : 'student_feedback'
					}
				: {})
		})
		.where(eq(questionQuality.questionId, questionId));
	return { accepted, summary };
}

export async function getQualityDashboardSnapshot(): Promise<QualityDashboardSnapshot> {
	const db = getNeonDatabase();
	const [countsRows, jobs, queue] = await Promise.all([
		db
			.select({
				total: sql<number>`count(${questionRegistry.questionId})::int`,
				good: sql<number>`count(*) filter (where ${questionQuality.finalVerdict} = 'good')::int`,
				bad: sql<number>`count(*) filter (where ${questionQuality.finalVerdict} = 'bad')::int`,
				awaitingHuman: sql<number>`count(*) filter (where ${questionQuality.needsHumanReview} = true)::int`,
				highPriority: sql<number>`count(*) filter (where ${questionQuality.feedbackPriority} = 'high')::int`
			})
			.from(questionRegistry)
			.leftJoin(questionQuality, eq(questionQuality.questionId, questionRegistry.questionId)),
		db
			.select()
			.from(qualityReviewJobs)
			.where(sql`${qualityReviewJobs.status} <> 'preview'`)
			.orderBy(desc(qualityReviewJobs.createdAt))
			.limit(10),
		db
			.select({
				questionId: questionQuality.questionId,
				apClass: sql<
					string | null
				>`coalesce(${questionQuality.apClass}, ${questionRegistry.apClass})`,
				unit: sql<string | null>`coalesce(${questionQuality.unit}, ${questionRegistry.unit})`,
				feedbackPriority: questionQuality.feedbackPriority,
				blindHumanReview: questionQuality.blindHumanReview,
				aiAssessment: questionQuality.aiAssessment,
				humanReviewReason: questionQuality.humanReviewReason,
				feedbackAnswerIncorrect: questionQuality.answerIncorrectCount,
				feedbackQuestionUnclear: questionQuality.questionUnclearCount,
				feedbackExplanationUnclear: questionQuality.explanationUnclearCount,
				uniqueReporters: questionQuality.uniqueReporters
			})
			.from(questionQuality)
			.leftJoin(questionRegistry, eq(questionRegistry.questionId, questionQuality.questionId))
			.where(eq(questionQuality.needsHumanReview, true))
			.orderBy(
				sql`case when ${questionQuality.feedbackPriority} = 'high' then 2 when ${questionQuality.feedbackPriority} = 'normal' then 1 else 0 end desc`,
				questionQuality.updatedAt
			)
			.limit(20)
	]);
	const counts = countsRows[0] ?? { total: 0, good: 0, bad: 0, awaitingHuman: 0, highPriority: 0 };
	const humanQueue = await Promise.all(
		queue.map(async (quality) => {
			let question: Awaited<ReturnType<typeof getQuestionById>> | null = null;
			try {
				question = await getQuestionById(quality.questionId);
			} catch {
				// The reviewer can still resolve metadata-only records if the question row is unavailable.
			}
			// Keep supporting optional stimulus fields if older rows contain them.
			const raw = question as Record<string, unknown> | null;
			return {
				questionId: quality.questionId,
				apClass: quality.apClass ?? question?.apClass,
				unit: quality.unit ?? question?.unit,
				stimulus:
					typeof raw?.stimulus === 'string'
						? raw.stimulus
						: typeof raw?.passage === 'string'
							? raw.passage
							: typeof raw?.context === 'string'
								? raw.context
								: undefined,
				question: question?.question,
				options: question
					? {
							A: question.optionA,
							B: question.optionB,
							C: question.optionC,
							D: question.optionD
						}
					: undefined,
				correctAnswer: question?.correctAnswer,
				explanation: question?.explanation,
				reason: quality.humanReviewReason || 'human_review',
				blind: quality.blindHumanReview,
				aiAssessment: quality.blindHumanReview
					? null
					: (quality.aiAssessment as AiQualityAssessment | null),
				feedbackSummary: {
					...feedbackSummaryFromCounts({
						answer_incorrect: quality.feedbackAnswerIncorrect,
						question_unclear: quality.feedbackQuestionUnclear,
						explanation_unclear: quality.feedbackExplanationUnclear
					}),
					uniqueReporters: quality.uniqueReporters,
					priority: quality.feedbackPriority as 'none' | 'normal' | 'high'
				}
			};
		})
	);
	return {
		counts: {
			unreviewed: Math.max(0, Number(counts.total) - Number(counts.good) - Number(counts.bad)),
			awaitingHuman: Number(counts.awaitingHuman),
			good: Number(counts.good),
			bad: Number(counts.bad),
			highPriority: Number(counts.highPriority)
		},
		model: modelName(),
		calibrated: true,
		jobs: jobs.map((job: Record<string, unknown>) =>
			toJobSummary(job as Partial<ReviewJobDocument>)
		),
		humanQueue
	};
}
