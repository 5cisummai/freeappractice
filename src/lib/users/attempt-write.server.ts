import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { mcqAttempts, userProgress } from '#lib/server/neon/schema.js';
import type { PracticeContext } from '#lib/users/practice-context.server.js';
import type { IQuestionAttempt } from '#lib/users/records.server.js';

export type PersistedProgress = {
	mastery: number;
	totalAttempts: number;
	correctAttempts: number;
	newlyRecorded: boolean;
};

export class AttemptContextConflictError extends Error {
	constructor() {
		super('This attempt ID is already used by another user or practice context.');
		this.name = 'AttemptContextConflictError';
	}
}

export type PersistQuestionAttemptOptions = {
	context?: PracticeContext;
	practiceSessionId?: string;
};

/** Store one MCQ attempt and update counters exactly once for a stable attempt ID. */
export async function persistQuestionAttempt(
	userId: string,
	attempt: IQuestionAttempt,
	attemptId: string = randomUUID(),
	options: PersistQuestionAttemptOptions = {}
): Promise<PersistedProgress> {
	const db = getNeonDatabase();
	const organizationId = options.context?.organizationId ?? null;
	const [existing] = await db
		.select({
			userId: mcqAttempts.userId,
			organizationId: mcqAttempts.organizationId,
			practiceSessionId: mcqAttempts.practiceSessionId
		})
		.from(mcqAttempts)
		.where(sql`${mcqAttempts.id} = ${attemptId}`)
		.limit(1);
	if (
		existing &&
		(existing.userId !== userId ||
			existing.organizationId !== organizationId ||
			existing.practiceSessionId !== (options.practiceSessionId ?? null))
	) {
		throw new AttemptContextConflictError();
	}
	const attemptDelta = attempt.wasCorrect === undefined ? 0 : 1;
	const correctDelta = attempt.wasCorrect ? 1 : 0;
	const progressConflict = organizationId
		? sql`ON CONFLICT (organization_id, user_id, course, unit)
			WHERE organization_id IS NOT NULL DO UPDATE SET`
		: sql`ON CONFLICT (user_id, course, unit)
			WHERE organization_id IS NULL DO UPDATE SET`;
	const result = await db.execute<{
		mastery: number;
		totalAttempts: number;
		correctAttempts: number;
		newlyRecorded: boolean;
	}>(sql`
		WITH inserted AS (
			INSERT INTO ${mcqAttempts} (
				id, user_id, organization_id, practice_session_id, question_id, course, unit,
				selected_answer, was_correct, time_taken_ms, attempted_at, created_at
			)
			VALUES (
				${attemptId}, ${userId}, ${organizationId}, ${options.practiceSessionId ?? null},
				${attempt.questionId}, ${attempt.course}, ${attempt.unit}, ${attempt.selectedAnswer},
				${attempt.wasCorrect},
				${attempt.timeTakenMs ?? null}, ${attempt.attemptedAt}, ${attempt.attemptedAt}
			)
			ON CONFLICT (id) DO NOTHING
			RETURNING id
		),
		progress AS (
			INSERT INTO ${userProgress} (
				user_id, organization_id, course, unit, mastery, total_attempts,
				correct_attempts, last_attempt_at, updated_at
			)
			SELECT
				${userId}, ${organizationId}, ${attempt.course}, ${attempt.unit},
				${attemptDelta ? correctDelta * 100 : 0}, ${attemptDelta}, ${correctDelta},
				${attempt.attemptedAt}, ${attempt.attemptedAt}
			FROM inserted
			${progressConflict}
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
		selected_progress AS (
			SELECT mastery, total_attempts, correct_attempts FROM progress
			UNION ALL
			SELECT mastery, total_attempts, correct_attempts
			FROM ${userProgress}
			WHERE user_id = ${userId}
				AND organization_id IS NOT DISTINCT FROM ${organizationId}
				AND course = ${attempt.course}
				AND unit = ${attempt.unit}
				AND NOT EXISTS (SELECT 1 FROM inserted)
			LIMIT 1
		)
		SELECT
			selected_progress.mastery,
			selected_progress.total_attempts AS "totalAttempts",
			selected_progress.correct_attempts AS "correctAttempts",
			EXISTS (SELECT 1 FROM inserted) AS "newlyRecorded"
		FROM selected_progress
	`);
	const progress = result.rows[0];
	if (!progress) throw new Error('Progress update returned no row');
	return {
		mastery: Number(progress.mastery),
		totalAttempts: Number(progress.totalAttempts),
		correctAttempts: Number(progress.correctAttempts),
		newlyRecorded: progress.newlyRecorded
	};
}
