import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { claimSuperFreeBeta, SuperFreeBetaUnavailableError } from '$lib/super/profile.server';

export const POST = withAuthedHandler(
	async (_event, userId) => {
		try {
			const claim = await claimSuperFreeBeta(userId);
			const entitlements = await getEntitlements(userId);
			return json({
				claimed: true,
				claimedAt: claim.claimedAt,
				entitlements
			});
		} catch (error) {
			if (error instanceof SuperFreeBetaUnavailableError) {
				return json({ error: error.message }, { status: 410 });
			}
			throw error;
		}
	},
	{ logLabel: 'Claim Super free beta error', errorMessage: 'Failed to claim free Super offer' }
);
