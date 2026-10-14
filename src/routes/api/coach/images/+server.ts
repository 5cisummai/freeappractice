import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { isCoachImagesEnabled } from '#lib/flags.js';

export const GET = withAuthedHandler(
	async () =>
		Response.json(
			{ enabled: await isCoachImagesEnabled() },
			{ headers: { 'Cache-Control': 'private, no-store' } }
		),
	{ logLabel: 'Coach image availability', errorMessage: 'Image input unavailable' }
);
