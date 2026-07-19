import { json, type RequestHandler } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { isMultiAttemptExperimentEnabled } from '$lib/flags';
import { getOrAssignMultiAttemptVariant } from '$lib/practice/assign-variant.server';
import {
	MULTI_ATTEMPT_EXPERIMENT_KEY,
	MULTI_ATTEMPT_EXPERIMENT_VERSION
} from '$lib/practice/multi-attempt';

const disabledResponse = () =>
	json({
		experimentKey: MULTI_ATTEMPT_EXPERIMENT_KEY,
		experimentVersion: MULTI_ATTEMPT_EXPERIMENT_VERSION,
		assignedVariant: 'control' as const,
		experimentEnabled: false
	});

/** Sticky assignment — no-op control response while the Vercel flag is off. */
export const GET: RequestHandler = async (event) => {
	if (!(await isMultiAttemptExperimentEnabled())) {
		return disabledResponse();
	}

	return withAuthedHandler(
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
	)(event);
};
