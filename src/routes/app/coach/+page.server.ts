import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { isSuperCoachEnabled } from '$lib/flags';
import { getPlanAccessForRequest } from '$lib/super/plan-access-cache.server';
import { hasPaidCapability } from '$lib/super/types';
import { getTutorProfileViewForRequest } from '$lib/super/profile-cache.server';
import { getRecentCoachAudits } from '$lib/super/coach.server';
import { getAssistantFeaturesEnabledForRequest } from '$lib/users/assistant-features.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	if (!(await getAssistantFeaturesEnabledForRequest(locals, userId))) {
		error(403, 'Assistant features are disabled for this account.');
	}
	const [planAccess, profile, coachEnabled] = await Promise.all([
		getPlanAccessForRequest(locals, userId),
		getTutorProfileViewForRequest(locals, userId),
		isSuperCoachEnabled()
	]);
	return {
		planAccess,
		hasCoachAccess: hasPaidCapability(planAccess, 'coach'),
		profile,
		coachEnabled,
		audits: hasPaidCapability(planAccess, 'coach') ? await getRecentCoachAudits(userId) : []
	};
};
