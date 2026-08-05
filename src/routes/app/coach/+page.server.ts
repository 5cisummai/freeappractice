import type { PageServerLoad } from './$types';
import { isSuperCoachEnabled } from '$lib/flags';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getTutorProfileView } from '$lib/super/profile.server';
import { getRecentCoachAudits } from '$lib/super/coach.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const [entitlements, profile, coachEnabled] = await Promise.all([
		getEntitlements(userId),
		getTutorProfileView(userId),
		isSuperCoachEnabled()
	]);
	return {
		entitlements,
		profile,
		coachEnabled,
		audits: entitlements.coach ? await getRecentCoachAudits(userId) : []
	};
};
