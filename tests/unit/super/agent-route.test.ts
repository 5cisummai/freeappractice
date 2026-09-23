import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	authorizeFeatureRequest: vi.fn(),
	createSuperAgentStreamResponse: vi.fn()
}));

vi.mock('$lib/super/feature-access.server', () => ({
	authorizeFeatureRequest: mocks.authorizeFeatureRequest
}));
vi.mock('$lib/super/agent-runtime.server', () => ({
	createSuperAgentStreamResponse: mocks.createSuperAgentStreamResponse
}));

import type { RequestEvent } from '@sveltejs/kit';
import { handleSuperAgentPost } from '$lib/super/agent-route.server';

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
	mocks.createSuperAgentStreamResponse.mockReset();
	mocks.authorizeFeatureRequest.mockResolvedValue({ allowed: true });
	mocks.createSuperAgentStreamResponse.mockResolvedValue(new Response('ok'));
});

describe('handleSuperAgentPost', () => {
	it('authorizes coach surface with the coach feature', async () => {
		await handleSuperAgentPost(
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
		expect(mocks.createSuperAgentStreamResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				context: expect.objectContaining({ surface: 'coach', page: 'coach' })
			})
		);
	});

	it.each(['mcq', 'frq'])(
		'rejects %s question tutoring before authorization or streaming',
		async (questionType) => {
			const response = await handleSuperAgentPost(
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
			expect(mocks.createSuperAgentStreamResponse).not.toHaveBeenCalled();
		}
	);
});
