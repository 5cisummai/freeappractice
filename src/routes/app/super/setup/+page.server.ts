import { and, desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { isSuperCheckoutEnabled, isSuperFreeBetaEnabled } from '$lib/flags';
import { getNeonDatabase } from '$lib/server/neon/db';
import { superBillingAccess } from '$lib/server/neon/schema';
import { isSuperStripeConfigured } from '$lib/super/billing.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getTutorProfileViewForRequest } from '$lib/super/profile-cache.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const [profile, entitlements, billing, checkoutEnabled, freeBetaEnabled, stripeConfigured] =
		await Promise.all([
			getTutorProfileViewForRequest(locals, userId),
			getEntitlements(userId),
			getNeonDatabase()
				.select()
				.from(superBillingAccess)
				.where(and(eq(superBillingAccess.userId, userId), eq(superBillingAccess.plan, 'super')))
				.orderBy(desc(superBillingAccess.updatedAt))
				.limit(1)
				.then(([record]) => record ?? null),
			isSuperCheckoutEnabled(),
			isSuperFreeBetaEnabled(),
			isSuperStripeConfigured()
		]);

	return {
		profile,
		entitlements,
		checkoutEnabled: checkoutEnabled && !freeBetaEnabled && stripeConfigured,
		freeBetaEnabled,
		billing: billing
			? {
					status: billing.status,
					subscriptionId: billing.stripeSubscriptionId ?? null,
					periodEnd: billing.periodEnd?.toISOString() ?? null,
					cancelAtPeriodEnd: billing.cancelAtPeriodEnd
				}
			: null
	};
};
