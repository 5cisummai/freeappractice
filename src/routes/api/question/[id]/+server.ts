import { json } from '@sveltejs/kit';
import { getQuestionFromS3 } from '$lib/server/services/question-storage';
import { withAuthedHandler } from '$lib/server/route-helpers';

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
