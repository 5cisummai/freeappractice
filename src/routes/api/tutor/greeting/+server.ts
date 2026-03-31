import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGreeting } from '$lib/server/services/tutor';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { question } = await request.json();
		if (!question) {
			return json({ error: 'Question is required' }, { status: 400 });
		}

		const message = await getGreeting(question);
		return json({ message });
	} catch (err) {
		console.error('Tutor greeting error:', err);
		return json(
			{
				error: 'Failed to get tutor greeting',
				message: "Hi! I'm here to help you understand this question. What would you like to know?"
			},
			{ status: 500 }
		);
	}
};
