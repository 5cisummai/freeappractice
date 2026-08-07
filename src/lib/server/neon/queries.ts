import { sql } from 'drizzle-orm';
import { getNeonDatabase } from './db';
import {
	bookmarks,
	coachAudits,
	experimentAssignments,
	frqAttemptCriterionGrades,
	frqAttemptGrades,
	frqAttempts,
	insightReports,
	mcqAttempts,
	questionFeedback,
	studyPlanAudits,
	studyPlans,
	superBillingAccess,
	superGrants,
	superUsageRollups,
	tutorProfileClasses,
	tutorProfiles,
	tutorTargetDates,
	userProgress,
	userProfiles,
	userSubjects
} from './schema';
import { inArray } from 'drizzle-orm';

export type McqAttemptWrite = {
	id: string;
	userId: string;
	questionId: string;
	apClass: string;
	unit: string;
	selectedAnswer?: 'A' | 'B' | 'C' | 'D';
	wasCorrect?: boolean;
	timeTakenMs?: number;
	attemptedAt: Date;
	finalAnswer?: 'A' | 'B' | 'C' | 'D';
	answerCount?: number;
	hintsShown?: number;
	terminalOutcome?: 'correct' | 'revealed' | 'max_attempts';
	experimentKey?: string;
	experimentVersion?: number;
	displayedVariant?: 'control' | 'multi_attempt_hints';
};

/**
 * Records an attempt and recomputes the affected progress bucket in one
 * PostgreSQL statement. This is the replacement for the old document update
 * that appended to questionHistory and then mutated progress separately.
 */
export async function recordMcqAttempt(input: McqAttemptWrite): Promise<void> {
	const db = getNeonDatabase();
	await db.execute(sql`
		WITH inserted AS (
			INSERT INTO app.mcq_attempts (
				id, user_id, question_id, ap_class, unit, selected_answer, was_correct,
				time_taken_ms, attempted_at, final_answer, answer_count, hints_shown,
				terminal_outcome, experiment_key, experiment_version, displayed_variant
			)
			VALUES (
				${input.id}, ${input.userId}, ${input.questionId}, ${input.apClass}, ${input.unit},
				${input.selectedAnswer ?? null}, ${input.wasCorrect ?? null}, ${input.timeTakenMs ?? null},
				${input.attemptedAt}, ${input.finalAnswer ?? null}, ${input.answerCount ?? null},
				${input.hintsShown ?? null}, ${input.terminalOutcome ?? null}, ${input.experimentKey ?? null},
				${input.experimentVersion ?? null}, ${input.displayedVariant ?? null}
			)
			ON CONFLICT (id) DO NOTHING
			RETURNING user_id, ap_class, unit
		), bucket AS (
			SELECT
				${input.userId}::text AS user_id,
				${input.apClass}::text AS ap_class,
				${input.unit}::text AS unit,
				COUNT(*)::int AS total_attempts,
				COUNT(*) FILTER (WHERE was_correct IS TRUE)::int AS correct_attempts,
				MAX(attempted_at) AS last_attempt_at
			FROM app.mcq_attempts
			WHERE user_id = ${input.userId}
				AND ap_class = ${input.apClass}
				AND unit = ${input.unit}
		)
		INSERT INTO app.user_progress (
			user_id, ap_class, unit, completed, mastery, total_attempts,
			correct_attempts, last_attempt_at, updated_at
		)
		SELECT
			user_id, ap_class, unit,
			(total_attempts > 0),
			CASE WHEN total_attempts = 0 THEN 0
				ELSE ROUND((correct_attempts::numeric / total_attempts::numeric) * 100, 2)::real
			END,
			total_attempts, correct_attempts, last_attempt_at, NOW()
		FROM bucket
	ON CONFLICT (user_id, ap_class, unit) DO UPDATE SET
		completed = EXCLUDED.completed,
		mastery = EXCLUDED.mastery,
		total_attempts = EXCLUDED.total_attempts,
		correct_attempts = EXCLUDED.correct_attempts,
		last_attempt_at = EXCLUDED.last_attempt_at,
		updated_at = NOW()
	`);
}

/** Atomically reserve daily generation capacity and return the new total. */
export async function reserveGenerationBudget(
	dayKey: string,
	delta: number,
	maximum: number
): Promise<number | null> {
	if (!Number.isInteger(delta) || delta < 1) throw new Error('delta must be a positive integer');
	if (!Number.isInteger(maximum) || maximum < delta) throw new Error('maximum must be >= delta');

	const db = getNeonDatabase();
	const rows = await db.execute<{ generations: number }>(sql`
		INSERT INTO ops.pool_generation_budgets (day_key, generations)
		VALUES (${dayKey}, ${delta})
		ON CONFLICT (day_key) DO UPDATE SET
			generations = ops.pool_generation_budgets.generations + ${delta},
			updated_at = NOW()
		WHERE ops.pool_generation_budgets.generations + ${delta} <= ${maximum}
		RETURNING generations
	`);
	return rows[0]?.generations ?? null;
}

/**
 * Claims one eligible refill row. The SELECT/UPDATE/RETURNING is a single
 * statement, so HTTP transport does not weaken the lease invariant.
 */
export async function claimPoolRefill(
	owner: string,
	leaseExpiresAt: Date,
	now = new Date()
): Promise<{ id: string; questionType: string; apClass: string; unit: string } | null> {
	const db = getNeonDatabase();
	const rows = await db.execute<{
		id: string;
		question_type: string;
		ap_class: string;
		unit: string;
	}>(sql`
		WITH candidate AS (
			SELECT id
			FROM ops.pool_refill_states
			WHERE (status IN ('pending', 'failed') AND (next_attempt_at IS NULL OR next_attempt_at <= ${now}))
				OR (status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ${now})
			ORDER BY requested_at ASC
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		UPDATE ops.pool_refill_states AS state
		SET status = 'running', lease_owner = ${owner}, lease_expires_at = ${leaseExpiresAt},
			attempts = state.attempts + 1, updated_at = NOW()
		FROM candidate
		WHERE state.id = candidate.id
		RETURNING state.id, state.question_type, state.ap_class, state.unit
	`);
	const row = rows[0];
	return row
		? { id: row.id, questionType: row.question_type, apClass: row.ap_class, unit: row.unit }
		: null;
}

/**
 * Deletes user-owned relational data with Neon HTTP batch requests. Foreign
 * keys handle nested children; the cleanup job is intentionally retained so
 * Mem0 deletion still completes after the auth user is removed.
 */
export async function deleteNeonUserData(userIds: string[]): Promise<void> {
	const ids = [...new Set(userIds.filter(Boolean))];
	if (!ids.length) return;
	const db = getNeonDatabase();

	await db.batch([
		db.delete(tutorTargetDates).where(inArray(tutorTargetDates.userId, ids)),
		db.delete(tutorProfileClasses).where(inArray(tutorProfileClasses.userId, ids)),
		db.delete(tutorProfiles).where(inArray(tutorProfiles.userId, ids)),
		db.delete(frqAttemptCriterionGrades).where(
		inArray(
			frqAttemptCriterionGrades.attemptId,
			db.select({ id: frqAttempts.id }).from(frqAttempts).where(inArray(frqAttempts.userId, ids))
		)
	),
		db.delete(frqAttemptGrades).where(
		inArray(
			frqAttemptGrades.attemptId,
			db.select({ id: frqAttempts.id }).from(frqAttempts).where(inArray(frqAttempts.userId, ids))
		)
	),
		db.delete(frqAttempts).where(inArray(frqAttempts.userId, ids)),
		db.delete(questionFeedback).where(inArray(questionFeedback.userId, ids)),
		db.delete(superBillingAccess).where(inArray(superBillingAccess.userId, ids)),
		db.delete(superGrants).where(inArray(superGrants.userId, ids)),
		db.delete(superUsageRollups).where(inArray(superUsageRollups.userId, ids)),
		db.delete(insightReports).where(inArray(insightReports.userId, ids)),
		db.delete(studyPlanAudits).where(inArray(studyPlanAudits.userId, ids)),
		db.delete(coachAudits).where(inArray(coachAudits.userId, ids)),
		db.delete(studyPlans).where(inArray(studyPlans.userId, ids)),
		db.delete(bookmarks).where(inArray(bookmarks.userId, ids)),
		db.delete(experimentAssignments).where(inArray(experimentAssignments.userId, ids)),
		db.delete(userProgress).where(inArray(userProgress.userId, ids)),
		db.delete(userSubjects).where(inArray(userSubjects.userId, ids)),
		db.delete(mcqAttempts).where(inArray(mcqAttempts.userId, ids)),
		db.delete(userProfiles).where(inArray(userProfiles.userId, ids))
	]);
}
