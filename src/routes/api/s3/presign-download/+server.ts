import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPresignedDownloadUrl } from '$lib/server/services/s3';
import { requireAuth } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	try {
		await requireAuth(event);

		const { key } = await event.request.json();
		if (!key) {
			return json({ error: 'key is required' }, { status: 400 });
		}

		const result = await getPresignedDownloadUrl({ key });
		return json(result);
	} catch (err) {
		if (err instanceof Response) return err;
		console.error('Presign download error:', err);
		return json({ error: 'Failed to generate download URL' }, { status: 500 });
	}
};
