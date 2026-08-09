import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { PracticeExperimentAssignment, PracticeVariant } from '$lib/practice/multi-attempt';
import {
	MULTI_ATTEMPT_EXPERIMENT_KEY,
	MULTI_ATTEMPT_EXPERIMENT_VERSION
} from '$lib/practice/multi-attempt';
import { isMultiAttemptExperimentEnabled } from '$lib/flags';
import { getNeonDatabase } from '$lib/server/neon/db';
import { experimentAssignments } from '$lib/server/neon/schema';

/** Stable 50/50 assignment from user id + experiment identity (not client-chosen). */
export function assignPracticeVariant(
	userId: string,
	key = MULTI_ATTEMPT_EXPERIMENT_KEY,
	version = MULTI_ATTEMPT_EXPERIMENT_VERSION
): PracticeVariant {
	const digest = createHash('sha256').update(`${key}:v${version}:${userId}`).digest();
	return digest[0]! % 2 === 0 ? 'control' : 'multi_attempt_hints';
}

/** Get or create sticky assignment for the multi-attempt experiment. */
export async function getOrAssignMultiAttemptVariant(userId: string): Promise<{
	assigned: PracticeVariant;
	assignment: PracticeExperimentAssignment;
	enabled: boolean;
}> {
	const enabled = await isMultiAttemptExperimentEnabled();
	const db = getNeonDatabase();
	const [existing] = await db
		.select({
			key: experimentAssignments.key,
			version: experimentAssignments.version,
			variant: experimentAssignments.variant
		})
		.from(experimentAssignments)
		.where(
			and(
				eq(experimentAssignments.userId, userId),
				eq(experimentAssignments.key, MULTI_ATTEMPT_EXPERIMENT_KEY),
				eq(experimentAssignments.version, MULTI_ATTEMPT_EXPERIMENT_VERSION)
			)
		)
		.limit(1);

	if (existing) {
		const assignment: PracticeExperimentAssignment = {
			key: existing.key,
			version: existing.version,
			variant: existing.variant as PracticeVariant
		};
		return {
			assigned: assignment.variant,
			assignment,
			enabled
		};
	}

	if (!enabled) {
		return {
			assigned: 'control',
			assignment: {
				key: MULTI_ATTEMPT_EXPERIMENT_KEY,
				version: MULTI_ATTEMPT_EXPERIMENT_VERSION,
				variant: 'control'
			},
			enabled: false
		};
	}

	const variant: PracticeVariant = assignPracticeVariant(userId);
	const assignment: PracticeExperimentAssignment = {
		key: MULTI_ATTEMPT_EXPERIMENT_KEY,
		version: MULTI_ATTEMPT_EXPERIMENT_VERSION,
		variant
	};

	await db
		.insert(experimentAssignments)
		.values({
			userId,
			...assignment
		})
		.onConflictDoUpdate({
			target: [experimentAssignments.userId, experimentAssignments.key],
			set: {
				version: assignment.version,
				variant: assignment.variant,
				updatedAt: new Date()
			}
		});

	return { assigned: variant, assignment, enabled };
}
