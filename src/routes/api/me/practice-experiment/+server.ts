import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { getOrAssignMultiAttemptVariant } from '$lib/practice/assign-variant.server';
import {
	MULTI_ATTEMPT_EXPERIMENT_KEY,
	MULTI_ATTEMPT_EXPERIMENT_VERSION
} from '$lib/practice/multi-attempt';

/** Returns sticky practice experiment assignment for the current user. */
export const GET = withAuthedHandler(
	async (_event, userId) => {
		const { assigned, assignment, enabled } = await getOrAssignMultiAttemptVariant(userId);
		return json({
			experimentKey: assignment.key ?? MULTI_ATTEMPT_EXPERIMENT_KEY,
			experimentVersion: assignment.version ?? MULTI_ATTEMPT_EXPERIMENT_VERSION,
			assignedVariant: assigned,
			experimentEnabled: enabled
		});
	},
	{ logLabel: 'Practice experiment error', errorMessage: 'Failed to load practice experiment' }
);
