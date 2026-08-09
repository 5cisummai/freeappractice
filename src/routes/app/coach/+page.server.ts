import type { PageServerLoad } from './$types';
import { isSuperCoachEnabled } from '$lib/flags';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getTutorProfileViewForRequest } from '$lib/super/profile-cache.server';
import { getRecentCoachAudits } from '$lib/super/coach.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const [entitlements, profile, coachEnabled] = await Promise.all([
		getEntitlements(userId),
		getTutorProfileViewForRequest(locals, userId),
		isSuperCoachEnabled()
	]);
	return {
		entitlements,
		profile,
		coachEnabled,
		audits: entitlements.coach ? await getRecentCoachAudits(userId) : []
	};
};
