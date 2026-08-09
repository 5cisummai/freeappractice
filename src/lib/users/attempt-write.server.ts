import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { mcqAttempts, referrals, userProgress } from '$lib/server/neon/schema';
import type { IQuestionAttempt } from '$lib/users/records.server';

export type PersistedProgress = {
	mastery: number;
	totalAttempts: number;
	correctAttempts: number;
	referralActivated: boolean;
	newlyRecorded: boolean;
};

/** Store one MCQ attempt and update counters exactly once for a stable attempt ID. */
export async function persistQuestionAttempt(
	userId: string,
	attempt: IQuestionAttempt,
	attemptId: string = randomUUID()
): Promise<PersistedProgress> {
	const db = getNeonDatabase();
	const attemptDelta = attempt.wasCorrect === undefined ? 0 : 1;
	const correctDelta = attempt.wasCorrect ? 1 : 0;
	const result = await db.execute<{
		mastery: number;
		totalAttempts: number;
		correctAttempts: number;
		referralActivated: boolean;
		newlyRecorded: boolean;
	}>(sql`
		WITH inserted AS (
			INSERT INTO ${mcqAttempts} (
				id, user_id, question_id, ap_class, unit, selected_answer, was_correct,
				time_taken_ms, attempted_at, final_answer, answer_count, hints_shown,
				terminal_outcome, experiment_key, experiment_version, displayed_variant, created_at
			)
			VALUES (
				${attemptId}, ${userId}, ${attempt.questionId}, ${attempt.apClass}, ${attempt.unit},
				${attempt.selectedAnswer ?? null}, ${attempt.wasCorrect ?? null},
				${attempt.timeTakenMs ?? null}, ${attempt.attemptedAt}, ${attempt.finalAnswer ?? null},
				${attempt.answerCount ?? null}, ${attempt.hintsShown ?? null},
				${attempt.terminalOutcome ?? null}, ${attempt.experimentKey ?? null},
				${attempt.experimentVersion ?? null}, ${attempt.displayedVariant ?? null},
				${attempt.attemptedAt}
			)
			ON CONFLICT (id) DO NOTHING
			RETURNING id
		),
		progress AS (
			INSERT INTO ${userProgress} (
				user_id, ap_class, unit, mastery, total_attempts, correct_attempts,
				last_attempt_at, updated_at
			)
			SELECT
				${userId}, ${attempt.apClass}, ${attempt.unit},
				${attemptDelta ? correctDelta * 100 : 0}, ${attemptDelta}, ${correctDelta},
				${attempt.attemptedAt}, ${attempt.attemptedAt}
			FROM inserted
			ON CONFLICT (user_id, ap_class, unit) DO UPDATE SET
				total_attempts = ${userProgress.totalAttempts} + EXCLUDED.total_attempts,
				correct_attempts = ${userProgress.correctAttempts} + EXCLUDED.correct_attempts,
				mastery = CASE
					WHEN EXCLUDED.total_attempts = 0 THEN ${userProgress.mastery}
					ELSE round(
						((${userProgress.correctAttempts} + EXCLUDED.correct_attempts)::numeric /
						 nullif(${userProgress.totalAttempts} + EXCLUDED.total_attempts, 0)) * 100
					)
				END,
				last_attempt_at = EXCLUDED.last_attempt_at,
				updated_at = EXCLUDED.updated_at
			RETURNING mastery, total_attempts, correct_attempts
		),
		activated AS (
			UPDATE ${referrals}
			SET activated_at = ${attempt.attemptedAt}, updated_at = ${attempt.attemptedAt}
			WHERE referred_user_id = ${userId}
				AND activated_at IS NULL
				AND EXISTS (SELECT 1 FROM inserted)
			RETURNING id
		),
		selected_progress AS (
			SELECT mastery, total_attempts, correct_attempts FROM progress
			UNION ALL
			SELECT mastery, total_attempts, correct_attempts
			FROM ${userProgress}
			WHERE user_id = ${userId}
				AND ap_class = ${attempt.apClass}
				AND unit = ${attempt.unit}
				AND NOT EXISTS (SELECT 1 FROM inserted)
			LIMIT 1
		)
		SELECT
			selected_progress.mastery,
			selected_progress.total_attempts AS "totalAttempts",
			selected_progress.correct_attempts AS "correctAttempts",
			EXISTS (SELECT 1 FROM activated) AS "referralActivated",
			EXISTS (SELECT 1 FROM inserted) AS "newlyRecorded"
		FROM selected_progress
	`);
	const progress = result.rows[0];
	if (!progress) throw new Error('Progress update returned no row');
	return {
		mastery: Number(progress.mastery),
		totalAttempts: Number(progress.totalAttempts),
		correctAttempts: Number(progress.correctAttempts),
		referralActivated: progress.referralActivated,
		newlyRecorded: progress.newlyRecorded
	};
}
