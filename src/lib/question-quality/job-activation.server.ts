import { asc, and, eq, gt, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	qualityReviewJobCandidates,
	qualityReviewJobItems,
	qualityReviewJobs
} from '$lib/server/neon/schema';
import { isCalibrationSample } from './rules.js';
import { transitionReviewJobStatus } from './transitions.js';

export interface ReviewJobActivation {
	jobId: string;
}

/**
 * Consume a preview and claim its questions in one database write.
 *
 * The small read establishes the exact Node-side calibration values. The
 * subsequent CTE is the only mutating operation and re-checks ownership,
 * status, and expiry before changing anything, so a stale reader cannot
 * activate a preview that another request already consumed.
 */
export async function activateReviewJob(
	previewId: string,
	actorId: string
): Promise<ReviewJobActivation | null> {
	const db = getNeonDatabase();
	const now = new Date();
	const activatedStatus = transitionReviewJobStatus('preview', 'activate');
	if (activatedStatus !== 'preparing') throw new Error('Invalid preview activation transition');
	const previewCandidates = await db
		.select({
			questionId: qualityReviewJobCandidates.questionId,
			rubricVersion: qualityReviewJobs.rubricVersion
		})
		.from(qualityReviewJobCandidates)
		.innerJoin(qualityReviewJobs, eq(qualityReviewJobCandidates.jobId, qualityReviewJobs.id))
		.where(
			and(
				eq(qualityReviewJobs.id, previewId),
				eq(qualityReviewJobs.status, 'preview'),
				eq(qualityReviewJobs.createdBy, actorId),
				gt(qualityReviewJobs.expiresAt, now),
				eq(qualityReviewJobCandidates.selected, true)
			)
		)
		.orderBy(asc(qualityReviewJobCandidates.position));

	const blindByQuestionId = Object.fromEntries(
		previewCandidates.map((candidate) => [
			candidate.questionId,
			isCalibrationSample(candidate.questionId, candidate.rubricVersion)
		])
	);

	const result = await db.execute<{ id: string }>(sql`
		WITH eligible_preview AS (
			SELECT id
			FROM ${qualityReviewJobs}
			WHERE id = ${previewId}
				AND status = 'preview'
				AND expires_at > now()
				AND created_by = ${actorId}
			FOR UPDATE
		),
		selected_candidates AS MATERIALIZED (
			SELECT candidates.job_id, candidates.question_id
			FROM ${qualityReviewJobCandidates} AS candidates
			JOIN eligible_preview AS preview ON preview.id = candidates.job_id
			WHERE candidates.selected = true
		),
		blind_candidates AS (
			SELECT selected.job_id, selected.question_id,
				COALESCE(blindness.value::boolean, false) AS blind
			FROM selected_candidates AS selected
			LEFT JOIN LATERAL jsonb_each_text(${JSON.stringify(blindByQuestionId)}::jsonb)
				AS blindness(question_id, value)
				ON blindness.question_id = selected.question_id
		),
		claimed_items AS (
			INSERT INTO ${qualityReviewJobItems}
				(id, job_id, question_id, status, attempts, blind, requires_web_search)
			SELECT
				md5(blind_candidates.job_id || ':' || blind_candidates.question_id),
				blind_candidates.job_id,
				blind_candidates.question_id,
				'queued',
				0,
				blind_candidates.blind,
				true
			FROM blind_candidates
			ON CONFLICT (question_id) DO UPDATE
			SET job_id = EXCLUDED.job_id,
				status = 'queued',
				attempts = 0,
				blind = EXCLUDED.blind,
				batch_id = NULL,
				submission_key = NULL,
				error = NULL,
				updated_at = now()
			WHERE status = 'failed'
			RETURNING job_id
		),
		claimed_counts AS (
			SELECT job_id, COUNT(*)::int AS count
			FROM claimed_items
			GROUP BY job_id
		),
		updated_job AS (
			UPDATE ${qualityReviewJobs}
			SET status = 'preparing',
				selected_count = COALESCE(claimed_counts.count, 0),
				queued_count = COALESCE(claimed_counts.count, 0),
				updated_at = now()
			FROM eligible_preview AS preview
			LEFT JOIN claimed_counts ON claimed_counts.job_id = preview.id
			WHERE ${qualityReviewJobs.id} = preview.id
			RETURNING ${qualityReviewJobs.id}
		),
		cleared_candidates AS (
			DELETE FROM ${qualityReviewJobCandidates}
			USING eligible_preview AS preview
			WHERE ${qualityReviewJobCandidates.jobId} = preview.id
			RETURNING ${qualityReviewJobCandidates.jobId}
		)
		SELECT updated_job.id
		FROM updated_job
		LEFT JOIN (
			SELECT DISTINCT job_id FROM cleared_candidates
		) AS cleared ON cleared.job_id = updated_job.id
	`);

	const row = result.rows[0];
	return row ? { jobId: row.id } : null;
}
