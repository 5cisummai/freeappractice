import { json } from '@sveltejs/kit';
import { getQuestionFromS3 } from '$lib/questions/storage.server';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';

export const GET = withAuthedHandler(
	async (event) => {
		const { id } = event.params;
		if (!id) return json({ error: 'Question ID is required' }, { status: 400 });

		const question = await getQuestionFromS3(id);
		if (!question) return json({ error: 'Question not found' }, { status: 404 });

		return json({ question });
	},
	{ logLabel: 'Get question error', errorMessage: 'Failed to fetch question' }
);
