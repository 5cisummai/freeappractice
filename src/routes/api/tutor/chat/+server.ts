import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chat } from '$lib/server/services/tutor';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const {
			question,
			answer,
			explanation,
			apClass,
			unit,
			answerChoices,
			conversationHistory,
			message
		} = body;

		if (!question || !message) {
			return json({ error: 'Question and message are required' }, { status: 400 });
		}

		const stream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();

				try {
					const generator = chat({
						question,
						correctAnswer: answer ?? '',
						explanation: explanation ?? '',
						apClass: apClass ?? '',
						unit: unit ?? '',
						answerChoices: answerChoices ?? null,
						conversationHistory: conversationHistory ?? [],
						userMessage: message
					});
					for await (const chunk of generator) {
						controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
					}

					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				} catch (err) {
					console.error('Tutor stream error:', err);
					controller.enqueue(
						new TextEncoder().encode(
							`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`
						)
					);
				} finally {
					controller.close();
				}
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	} catch (err) {
		console.error('Tutor chat error:', err);
		return json({ error: 'Failed to start tutor chat' }, { status: 500 });
	}
};
