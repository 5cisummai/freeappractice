import { isAdminUser } from '#lib/auth/admin.server.js';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { grantIndefiniteSuperToClaimedFreeBetaUsers } from '#lib/billing/admin.server.js';

export const POST = withAuthedHandler(
	async (event) => {
		if (!isAdminUser(event.locals.user!)) {
			return Response.json({ error: 'Admin access required' }, { status: 403 });
		}
		return Response.json(await grantIndefiniteSuperToClaimedFreeBetaUsers(event.locals.user!.id));
	},
	{
		logLabel: 'Grant indefinite Super to free beta users error',
		errorMessage: 'Failed to grant indefinite Super to free beta users'
	}
);
