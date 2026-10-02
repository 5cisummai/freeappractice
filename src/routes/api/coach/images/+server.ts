import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { isCoachImagesEnabled } from '$lib/flags';

export const GET = withAuthedHandler(
	async () =>
		json(
			{ enabled: await isCoachImagesEnabled() },
			{ headers: { 'Cache-Control': 'private, no-store' } }
		),
	{ logLabel: 'Coach image availability', errorMessage: 'Image input unavailable' }
);
