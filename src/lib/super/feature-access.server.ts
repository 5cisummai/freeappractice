import { getEntitlements } from '$lib/super/entitlements.server';
import { getTutorProfileView } from '$lib/super/profile.server';

export type SuperFeature = 'coach' | 'aiInsights' | 'studyPlans';

export type SuperFeatureAccess =
	{ allowed: true } | { allowed: false; reason: 'subscription' | 'age' };

/** Shared server-side entitlement and 13+ gate for personalized Super surfaces. */
export async function getSuperFeatureAccess(
	userId: string,
	feature: SuperFeature
): Promise<SuperFeatureAccess> {
	const [entitlements, profile] = await Promise.all([
		getEntitlements(userId),
		getTutorProfileView(userId)
	]);
	if (!entitlements[feature]) return { allowed: false, reason: 'subscription' };
	if (!profile.ageConfirmedAt) return { allowed: false, reason: 'age' };
	return { allowed: true };
}

export function superFeatureAccessMessage(
	access: Exclude<SuperFeatureAccess, { allowed: true }>,
	label: string
): string {
	return access.reason === 'subscription'
		? 'Super subscription required'
		: `Confirm that you are at least 13 to use ${label}.`;
}
