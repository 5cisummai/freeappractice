import type { PageServerLoad } from './$types';
import { isSuperCheckoutEnabled, isSuperFreeBetaEnabled } from '$lib/flags';
import { getSuperBillingView, isSuperStripeConfigured } from '$lib/super/billing.server';
import { getPlanAccessForRequest } from '$lib/super/plan-access-cache.server';
import { getTutorProfileViewForRequest } from '$lib/super/profile-cache.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const [profile, planAccess, billing, checkoutEnabled, freeBetaEnabled, stripeConfigured] =
		await Promise.all([
			getTutorProfileViewForRequest(locals, userId),
			getPlanAccessForRequest(locals, userId),
			getSuperBillingView(userId),
			isSuperCheckoutEnabled(),
			isSuperFreeBetaEnabled(),
			isSuperStripeConfigured()
		]);

	return {
		profile,
		planAccess,
		checkoutEnabled: checkoutEnabled && !freeBetaEnabled && stripeConfigured,
		freeBetaEnabled,
		billing
	};
};
