import { json } from '@sveltejs/kit';
import { isAdminUser } from '$lib/auth/admin.server';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { grantIndefiniteSuperToClaimedFreeBetaUsers } from '$lib/super/admin.server';

export const POST = withAuthedHandler(
	async (event) => {
		if (!isAdminUser(event.locals.user!)) {
			return json({ error: 'Admin access required' }, { status: 403 });
		}
		return json(await grantIndefiniteSuperToClaimedFreeBetaUsers(event.locals.user!.id));
	},
	{
		logLabel: 'Grant indefinite Super to free beta users error',
		errorMessage: 'Failed to grant indefinite Super to free beta users'
	}
);
