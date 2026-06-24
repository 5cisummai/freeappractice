import { json } from '@sveltejs/kit';
import {
	getPresignedDownloadUrl,
	S3ConfigError,
	S3KeyValidationError
} from '$lib/questions/s3.server';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';

export const POST = withAuthedHandler(
	async (event) => {
		const { key } = await event.request.json();
		if (!key) {
			return json({ error: 'key is required' }, { status: 400 });
		}

		try {
			const result = await getPresignedDownloadUrl({ key });
			return json(result);
		} catch (err) {
			if (err instanceof S3KeyValidationError || err instanceof S3ConfigError) {
				return json({ error: err.message }, { status: 400 });
			}
			throw err;
		}
	},
	{ logLabel: 'Presign download error', errorMessage: 'Failed to generate download URL' }
);
