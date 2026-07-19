import { env } from '$env/dynamic/private';
import { connectDb } from '$lib/server/db';
import { getQuestionFromS3 } from '$lib/questions/storage.server';
import { QuestionId } from '$lib/questions/question-id-model.server';
import {
	QuestionFeedback,
	QuestionQuality,
	QuestionQualityReviewJob,
	type ReviewJobDocument
} from './models.server.js';
import { feedbackSummaryFromCounts } from './rules.js';
import {
	QUESTION_QUALITY_RUBRIC_VERSION,
	type FeedbackSummary,
	type FeedbackType,
	type QualityDashboardSnapshot,
	type QualityJobSummary
} from './types.js';

export function modelName(): string {
	return env.QUESTION_QUALITY_MODEL?.trim() || 'gpt-5.6-luna';
}

export function isAgentCalibrated(): boolean {
	return (
		env.QUESTION_QUALITY_AGENT_CALIBRATED === 'true' &&
		env.QUESTION_QUALITY_CALIBRATED_MODEL === modelName() &&
		env.QUESTION_QUALITY_CALIBRATED_RUBRIC === QUESTION_QUALITY_RUBRIC_VERSION &&
		env.QUESTION_QUALITY_CALIBRATED_REASONING_EFFORT ===
			(env.QUESTION_QUALITY_REASONING_EFFORT || 'medium')
	);
}

export function toJobSummary(
	job: Partial<ReviewJobDocument> & { _id?: unknown }
): QualityJobSummary {
	return {
		id: String(job._id),
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
	await connectDb();
	const questionId = opts.questionId.trim();
	if (!questionId || !(await QuestionId.exists({ questionId })))
		throw new Error('Question not found');
	let accepted = false;
	try {
		const result = await QuestionFeedback.updateOne(
			{ questionId, userId: opts.userId, type: opts.type },
			{
				$setOnInsert: {
					questionId,
					userId: opts.userId,
					type: opts.type,
					apClass: opts.apClass,
					unit: opts.unit
				}
			},
			{ upsert: true }
		);
		accepted = result.upsertedCount > 0;
	} catch (error) {
		if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)) {
			throw error;
		}
	}
	const aggregates = await QuestionFeedback.aggregate<{
		_id: FeedbackType;
		users: string[];
	}>([{ $match: { questionId } }, { $group: { _id: '$type', users: { $addToSet: '$userId' } } }]);
	const counts: Partial<Record<FeedbackType, number>> = {};
	const allUsers = new Set<string>();
	for (const aggregate of aggregates) {
		counts[aggregate._id] = aggregate.users.length;
		for (const userId of aggregate.users) allUsers.add(userId);
	}
	const summary = { ...feedbackSummaryFromCounts(counts), uniqueReporters: allUsers.size };
	await QuestionQuality.updateOne(
		{ questionId },
		{ $setOnInsert: { questionId, state: 'unreviewed' } },
		{ upsert: true }
	);
	await QuestionQuality.updateOne(
		{ questionId },
		{
			$max: {
				'feedbackSummary.answerIncorrect': summary.answerIncorrect,
				'feedbackSummary.questionUnclear': summary.questionUnclear,
				'feedbackSummary.explanationUnclear': summary.explanationUnclear,
				'feedbackSummary.uniqueReporters': summary.uniqueReporters
			},
			...(summary.priority !== 'none'
				? {
						$set: {
							needsHumanReview: true,
							humanReviewReason:
								summary.priority === 'high' ? 'student_feedback_escalation' : 'student_feedback'
						}
					}
				: {})
		}
	);
	if (summary.priority === 'high') {
		await QuestionQuality.updateOne(
			{ questionId },
			{
				$set: {
					'feedbackSummary.priority': 'high',
					humanReviewReason: 'student_feedback_escalation'
				}
			}
		);
	} else if (summary.priority === 'normal') {
		await QuestionQuality.updateOne(
			{ questionId, 'feedbackSummary.priority': { $ne: 'high' } },
			{ $set: { 'feedbackSummary.priority': 'normal' } }
		);
	}
	return { accepted, summary };
}

export async function getQualityDashboardSnapshot(): Promise<QualityDashboardSnapshot> {
	await connectDb();
	const [totalQuestions, finalGood, finalBad, awaitingHuman, highPriority, jobs, queue] =
		await Promise.all([
			QuestionId.countDocuments({}),
			QuestionQuality.countDocuments({ finalVerdict: 'good' }),
			QuestionQuality.countDocuments({ finalVerdict: 'bad' }),
			QuestionQuality.countDocuments({ needsHumanReview: true }),
			QuestionQuality.countDocuments({ 'feedbackSummary.priority': 'high' }),
			QuestionQualityReviewJob.find({ status: { $ne: 'preview' } })
				.sort({ createdAt: -1 })
				.limit(10)
				.lean()
				.exec(),
			QuestionQuality.find({ needsHumanReview: true })
				.sort({ updatedAt: 1 })
				.limit(100)
				.lean()
				.exec()
		]);
	queue.sort((a, b) => {
		const score = (priority?: string) => (priority === 'high' ? 2 : priority === 'normal' ? 1 : 0);
		return score(b.feedbackSummary?.priority) - score(a.feedbackSummary?.priority);
	});
	const humanQueue = await Promise.all(
		queue.slice(0, 20).map(async (quality) => {
			let question: Awaited<ReturnType<typeof getQuestionFromS3>> | null = null;
			try {
				question = await getQuestionFromS3(quality.questionId);
			} catch {
				// The reviewer can still resolve metadata-only records if S3 is temporarily unavailable.
			}
			// S3 payloads may include stimulus/passage/context beyond StoredQuestion.
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
				aiAssessment: quality.blindHumanReview ? null : quality.aiAssessment,
				feedbackSummary: quality.feedbackSummary ?? feedbackSummaryFromCounts({})
			};
		})
	);
	return {
		counts: {
			unreviewed: Math.max(0, totalQuestions - finalGood - finalBad),
			awaitingHuman,
			good: finalGood,
			bad: finalBad,
			highPriority
		},
		model: modelName(),
		calibrated: isAgentCalibrated(),
		jobs: jobs.map((job) => toJobSummary(job)),
		humanQueue
	};
}
