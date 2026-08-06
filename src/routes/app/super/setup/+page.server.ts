import type { PageServerLoad } from './$types';
import { isSuperCheckoutEnabled, isSuperFreeBetaEnabled } from '$lib/flags';
import { SuperBillingAccess } from '$lib/super/models.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getTutorProfileView } from '$lib/super/profile.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const [profile, entitlements, billing, checkoutEnabled, freeBetaEnabled] = await Promise.all([
		getTutorProfileView(userId),
		getEntitlements(userId),
		SuperBillingAccess.findOne({ userId, plan: 'super' }).sort({ updatedAt: -1 }).lean().exec(),
		isSuperCheckoutEnabled(),
		isSuperFreeBetaEnabled()
	]);

	return {
		profile,
		entitlements,
		checkoutEnabled: checkoutEnabled && !freeBetaEnabled,
		freeBetaEnabled,
		billing: billing
			? {
					status: billing.status,
					periodEnd: billing.periodEnd?.toISOString() ?? null,
					cancelAtPeriodEnd: billing.cancelAtPeriodEnd
				}
			: null
	};
};
