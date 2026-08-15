import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { getPlanAccessForRequest } from '$lib/super/feature-access.server';
import { claimSuperFreeBeta, SuperFreeBetaUnavailableError } from '$lib/super/profile.server';

export const POST = withAuthedHandler(
	async (event, userId) => {
		try {
			const claim = await claimSuperFreeBeta(userId);
			const planAccess = await getPlanAccessForRequest(event.locals, userId);
			return json({
				claimed: true,
				claimedAt: claim.claimedAt,
				planAccess
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
