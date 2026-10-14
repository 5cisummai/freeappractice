import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { getPlanAccessForRequest } from '#lib/agent/access.server.js';
import {
	claimSuperFreeBeta,
	SuperFreeBetaUnavailableError
} from '#lib/agent/personalization/profile.server.js';

export const POST = withAuthedHandler(
	async (event, userId) => {
		try {
			const claim = await claimSuperFreeBeta(userId);
			const planAccess = await getPlanAccessForRequest(event.locals, userId);
			return Response.json({
				claimed: true,
				claimedAt: claim.claimedAt,
				planAccess
			});
		} catch (error) {
			if (error instanceof SuperFreeBetaUnavailableError) {
				return Response.json({ error: error.message }, { status: 410 });
			}
			throw error;
		}
	},
	{ logLabel: 'Claim Super free beta error', errorMessage: 'Failed to claim free Super offer' }
);
