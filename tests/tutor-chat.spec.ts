import { expect, test } from '@playwright/test';

const validRequest = {
	question: 'Which process produces ATP in the mitochondria?',
	answer: 'Cellular respiration',
	explanation: 'Cells convert stored chemical energy into ATP.',
	apClass: 'AP Biology',
	unit: 'Cellular energetics',
	answerChoices: {
		A: 'Photosynthesis',
		B: 'Cellular respiration',
		C: 'Transcription',
		D: 'Translation'
	},
	conversationHistory: [
		{ role: 'assistant', content: 'What part of the process is confusing?' },
		{ role: 'user', content: 'I am unsure where ATP is produced.' }
	],
	message: 'Can you give me a hint?'
};

test.describe('tutor chat request limits', () => {
	test('rejects a request body over the byte budget', async ({ request }) => {
		const response = await request.post('/api/tutor/chat', {
			data: { ...validRequest, explanation: 'x'.repeat(33 * 1024) }
		});

		expect(response.status()).toBe(413);
		await expect(response.json()).resolves.toMatchObject({
			error: 'Tutor chat request is too large'
		});
	});

	test('rejects too many conversation messages', async ({ request }) => {
		const response = await request.post('/api/tutor/chat', {
			data: {
				...validRequest,
				conversationHistory: Array.from({ length: 13 }, (_, index) => ({
					role: index % 2 === 0 ? 'assistant' : 'user',
					content: `Message ${index}`
				}))
			}
		});

		expect(response.status()).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: 'Invalid tutor chat request',
			details: expect.arrayContaining(['Conversation history is too long'])
		});
	});

	test('rejects an oversized user message', async ({ request }) => {
		const response = await request.post('/api/tutor/chat', {
			data: {
				...validRequest,
				message: 'm'.repeat(2_001)
			}
		});

		expect(response.status()).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: 'Invalid tutor chat request',
			details: expect.arrayContaining(['Message is too long'])
		});
	});

	test('rejects oversized history content and aggregate prompt context', async ({ request }) => {
		const oversizedHistoryItem = await request.post('/api/tutor/chat', {
			data: {
				...validRequest,
				conversationHistory: [{ role: 'user', content: 'x'.repeat(2_001) }]
			}
		});
		expect(oversizedHistoryItem.status()).toBe(400);
		await expect(oversizedHistoryItem.json()).resolves.toMatchObject({
			error: 'Invalid tutor chat request',
			details: expect.arrayContaining(['Conversation message is too long'])
		});

		const oversizedContext = await request.post('/api/tutor/chat', {
			data: {
				...validRequest,
				question: 'q'.repeat(4_000),
				explanation: 'e'.repeat(6_000),
				message: 'm'.repeat(2_000),
				conversationHistory: [
					{ role: 'assistant', content: 'a'.repeat(2_000) },
					{ role: 'user', content: 'u'.repeat(2_000) }
				]
			}
		});
		expect(oversizedContext.status()).toBe(400);
		await expect(oversizedContext.json()).resolves.toMatchObject({
			error: 'Invalid tutor chat request',
			details: expect.arrayContaining(['Tutor chat context is too large'])
		});
	});

	test('rejects malformed JSON with a clear client error', async ({ request }) => {
		const response = await request.post('/api/tutor/chat', {
			headers: { 'content-type': 'application/json' },
			// Buffer avoids Playwright JSON-encoding a string body into a valid JSON string.
			data: Buffer.from('{not-json', 'utf8')
		});

		expect(response.status()).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: 'Tutor chat request must be valid JSON'
		});
	});
});
