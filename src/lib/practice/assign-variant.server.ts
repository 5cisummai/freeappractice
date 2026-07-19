import { createHash } from 'node:crypto';
import type { PracticeExperimentAssignment, PracticeVariant } from '$lib/practice/multi-attempt';
import {
	MULTI_ATTEMPT_EXPERIMENT_KEY,
	MULTI_ATTEMPT_EXPERIMENT_VERSION
} from '$lib/practice/multi-attempt';
import { findUserProfileOrFail } from '$lib/users/profile.server';
import { isMultiAttemptExperimentEnabled } from '$lib/flags';

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
	const user = await findUserProfileOrFail(userId);
	const existing = user.practiceExperiments?.find(
		(entry) =>
			entry.key === MULTI_ATTEMPT_EXPERIMENT_KEY &&
			entry.version === MULTI_ATTEMPT_EXPERIMENT_VERSION
	);

	if (existing) {
		return {
			assigned: existing.variant,
			assignment: existing,
			enabled
		};
	}

	const variant: PracticeVariant = enabled ? assignPracticeVariant(userId) : 'control';
	const assignment: PracticeExperimentAssignment = {
		key: MULTI_ATTEMPT_EXPERIMENT_KEY,
		version: MULTI_ATTEMPT_EXPERIMENT_VERSION,
		variant
	};

	if (!user.practiceExperiments) user.practiceExperiments = [];
	user.practiceExperiments.push(assignment);
	await user.save();

	return { assigned: variant, assignment, enabled };
}
