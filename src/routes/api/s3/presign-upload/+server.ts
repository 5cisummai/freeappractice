import { json } from '@sveltejs/kit';
import {
	getPresignedUploadUrl,
	S3ConfigError,
	S3KeyValidationError
} from '$lib/questions/s3.server';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';

export const POST = withAuthedHandler(
	async (event) => {
		const { key, contentType } = await event.request.json();
		if (!key || !contentType) {
			return json({ error: 'key and contentType are required' }, { status: 400 });
		}

		try {
			const result = await getPresignedUploadUrl({ key, contentType });
			return json(result);
		} catch (err) {
			if (err instanceof S3KeyValidationError || err instanceof S3ConfigError) {
				return json({ error: err.message }, { status: 400 });
			}
			throw err;
		}
	},
	{ logLabel: 'Presign upload error', errorMessage: 'Failed to generate upload URL' }
);
