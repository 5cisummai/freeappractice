import { json } from '@sveltejs/kit';
import {
	MULTI_ATTEMPT_EXPERIMENT_KEY,
	MULTI_ATTEMPT_EXPERIMENT_VERSION
} from '$lib/practice/multi-attempt';

/** Temporary kill switch: keep the optional experiment from affecting practice/auth flows. */
export const GET = () =>
	json({
		experimentKey: MULTI_ATTEMPT_EXPERIMENT_KEY,
		experimentVersion: MULTI_ATTEMPT_EXPERIMENT_VERSION,
		assignedVariant: 'control',
		experimentEnabled: false
	});
