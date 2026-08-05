import type { PageServerLoad } from './$types';
import { isSuperCheckoutEnabled } from '$lib/flags';
import { SuperBillingAccess } from '$lib/super/models.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getTutorProfileView } from '$lib/super/profile.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const [profile, entitlements, billing, checkoutEnabled] = await Promise.all([
		getTutorProfileView(userId),
		getEntitlements(userId),
		SuperBillingAccess.findOne({ userId, plan: 'super' }).sort({ updatedAt: -1 }).lean().exec(),
		isSuperCheckoutEnabled()
	]);

	return {
		profile,
		entitlements,
		checkoutEnabled,
		billing: billing
			? {
					status: billing.status,
					periodEnd: billing.periodEnd?.toISOString() ?? null,
					cancelAtPeriodEnd: billing.cancelAtPeriodEnd
				}
			: null
	};
};
