import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPresignedUploadUrl } from '$lib/server/services/s3';
import { requireAuth } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	try {
		await requireAuth(event);

		const { key, contentType } = await event.request.json();
		if (!key || !contentType) {
			return json({ error: 'key and contentType are required' }, { status: 400 });
		}

		const result = await getPresignedUploadUrl({ key, contentType });
		return json(result);
	} catch (err) {
		if (err instanceof Response) return err;
		console.error('Presign upload error:', err);
		return json({ error: 'Failed to generate upload URL' }, { status: 500 });
	}
};
