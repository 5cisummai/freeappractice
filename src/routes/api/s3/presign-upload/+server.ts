import { json } from '@sveltejs/kit';
import { getPresignedUploadUrl } from '$lib/server/services/s3';
import { withAuthedHandler } from '$lib/server/route-helpers';

export const POST = withAuthedHandler(
	async (event) => {
		const { key, contentType } = await event.request.json();
		if (!key || !contentType) {
			return json({ error: 'key and contentType are required' }, { status: 400 });
		}

		const result = await getPresignedUploadUrl({ key, contentType });
		return json(result);
	},
	{ logLabel: 'Presign upload error', errorMessage: 'Failed to generate upload URL' }
);
