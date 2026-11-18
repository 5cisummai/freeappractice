import { beforeEach, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const mocks = vi.hoisted(() => ({ transcribe: vi.fn(), start: vi.fn(), charge: vi.fn() }));
vi.mock('ai', () => ({
	gateway: { transcription: () => 'grok-stt' },
	transcribe: mocks.transcribe
}));
vi.mock('#lib/agent/access.server.js', () => ({
	authorizeFeatureRequest: async () => ({
		allowed: true,
		planAccess: { accessReason: 'subscription' }
	})
}));
vi.mock('#lib/agent/usage/turn.server.js', () => ({ startAgentTurn: mocks.start }));
vi.mock('#lib/agent/usage/controls.server.js', () => ({
	RedisRequiredError: class extends Error {}
}));
vi.mock('#lib/auth/route-helpers.server.js', () => ({
	withAuthedHandler:
		(handler: (event: RequestEvent, userId: string) => Promise<Response>) =>
		(event: RequestEvent) =>
			handler(event, 'student')
}));
vi.mock('#lib/server/logger.js', () => ({ logger: { error: vi.fn() } }));

import { POST } from '../../../src/routes/api/coach/dictate/+server';
import { millicreditsFromLanguageModelUsage } from '#lib/agent/usage/credits.js';

function request() {
	return POST({
		url: new URL('https://app.test/api/coach/dictate'),
		request: new Request('https://app.test/api/coach/dictate', {
			method: 'POST',
			headers: { origin: 'https://app.test', 'Content-Type': 'application/json' },
			body: JSON.stringify({ audio: 'YXVkaW8=' })
		})
	} as RequestEvent);
}

beforeEach(() => {
	vi.resetAllMocks();
	mocks.transcribe.mockResolvedValue({ text: 'Dictated text' });
	mocks.start.mockResolvedValue({
		kind: 'available',
		usage: { remaining: 100 },
		chargeUsage: mocks.charge
	});
	mocks.charge.mockResolvedValue(undefined);
});

it('charges exactly 0.1 credit for a successful transcription', async () => {
	const response = await request();
	expect(response.status).toBe(200);
	const [usage, usd] = mocks.charge.mock.calls[0];
	expect(millicreditsFromLanguageModelUsage(usage, usd)).toBe(100);
	expect(await response.json()).toEqual({ text: 'Dictated text' });
});

it.each([
	{ kind: 'exhausted' },
	{ kind: 'available', usage: { remaining: 99 } },
	{ kind: 'rate-limited' }
])('refuses transcription when usage controls reject the session (%j)', async (turn) => {
	mocks.start.mockResolvedValue(turn);
	expect((await request()).status).toBe(429);
	expect(mocks.transcribe).not.toHaveBeenCalled();
	expect(mocks.charge).not.toHaveBeenCalled();
});

it('does not charge when transcription fails', async () => {
	mocks.transcribe.mockRejectedValue(new Error('Gateway unavailable'));
	expect((await request()).status).toBe(502);
	expect(mocks.charge).not.toHaveBeenCalled();
});

it('reports failure if the usage charge fails', async () => {
	mocks.charge.mockRejectedValue(new Error('Usage write failed'));
	const response = await request();
	expect(response.status).toBe(502);
	expect(await response.text()).not.toContain('Dictated text');
});
