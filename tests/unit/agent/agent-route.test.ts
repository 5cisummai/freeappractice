import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	authorizeFeatureRequest: vi.fn(),
	createAgentStreamResponse: vi.fn()
}));

vi.mock('#lib/agent/access.server.js', () => ({
	authorizeFeatureRequest: mocks.authorizeFeatureRequest
}));
vi.mock('#lib/agent/stream.server.js', () => ({
	createAgentStreamResponse: mocks.createAgentStreamResponse
}));

import type { RequestEvent } from '@sveltejs/kit';
import { handleAgentPost } from '#lib/agent/route.server.js';

const sessionId = 'c8f3048f-1681-47f2-b1db-e912655275d0';

function event(body: unknown): RequestEvent {
	return {
		request: new Request('https://app.test/api/super/agent', {
			method: 'POST',
			body: JSON.stringify(body),
			headers: { 'content-type': 'application/json' }
		}),
		locals: {}
	} as RequestEvent;
}

beforeEach(() => {
	mocks.authorizeFeatureRequest.mockReset();
	mocks.createAgentStreamResponse.mockReset();
	mocks.authorizeFeatureRequest.mockResolvedValue({
		allowed: true,
		planAccess: { plan: 'super', accessReason: 'subscription' }
	});
	mocks.createAgentStreamResponse.mockResolvedValue(new Response('ok'));
});

describe('handleAgentPost', () => {
	it('authorizes coach surface with the coach feature', async () => {
		await handleAgentPost(
			event({
				sessionId,
				context: { surface: 'coach', page: 'coach' },
				messages: [{ role: 'user', parts: [{ type: 'text', text: 'Plan my week' }] }]
			}),
			'user-1'
		);

		expect(mocks.authorizeFeatureRequest).toHaveBeenCalledWith(
			expect.anything(),
			'user-1',
			'coach'
		);
		expect(mocks.createAgentStreamResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				context: expect.objectContaining({ surface: 'coach', page: 'coach' })
			})
		);
	});

	it.each(['mcq', 'frq'])(
		'rejects %s question tutoring before authorization or streaming',
		async (questionType) => {
			const response = await handleAgentPost(
				event({
					sessionId,
					context: {
						surface: 'question',
						page: 'practice',
						questionId: sessionId,
						questionType
					},
					messages: [{ role: 'user', parts: [{ type: 'text', text: 'Help' }] }]
				}),
				'user-1'
			);

			expect(response.status).toBe(404);
			expect(mocks.authorizeFeatureRequest).not.toHaveBeenCalled();
			expect(mocks.createAgentStreamResponse).not.toHaveBeenCalled();
		}
	);
});
