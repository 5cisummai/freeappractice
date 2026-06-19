import { json } from '@sveltejs/kit';
import { getPresignedDownloadUrl } from '$lib/server/services/s3';
import { withAuthedHandler } from '$lib/server/route-helpers';

export const POST = withAuthedHandler(
	async (event) => {
		const { key } = await event.request.json();
		if (!key) {
			return json({ error: 'key is required' }, { status: 400 });
		}

		const result = await getPresignedDownloadUrl({ key });
		return json(result);
	},
	{ logLabel: 'Presign download error', errorMessage: 'Failed to generate download URL' }
);
