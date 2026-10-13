import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { getOwnedCoachImage } from '#lib/agent/attachments/images.server.js';
import { readCoachImage, type CoachImageStore } from '#lib/agent/attachments/storage.server.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const row = await getOwnedCoachImage(userId, event.params.id ?? '');
		if (!row)
			return Response.json(
				{ error: 'Image not found' },
				{ status: 404, headers: { 'Cache-Control': 'private, no-store' } }
			);
		const bytes = await readCoachImage(row.store as CoachImageStore, row.pathname);
		return new Response(new Uint8Array(bytes), {
			headers: {
				'Content-Type': 'image/webp',
				'Cache-Control': 'private, no-store',
				'Content-Disposition': 'inline; filename="coach-image.webp"',
				'X-Content-Type-Options': 'nosniff',
				'Cross-Origin-Resource-Policy': 'same-origin'
			}
		});
	},
	{ logLabel: 'Coach image preview failed', errorMessage: 'Image unavailable' }
);
