import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/server/route-helpers';
import { findUserOrFail } from '$lib/server/utils';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const user = await findUserOrFail(
			userId,
			'-password -emailToken -emailTokenExpires -resetPasswordToken -resetPasswordExpires'
		);

		return json({
			user: {
				userId: user._id,
				name: user.name,
				email: user.email,
				verified: user.verified
			}
		});
	},
	{ logLabel: 'Current user error', errorMessage: 'Failed to get user' }
);
