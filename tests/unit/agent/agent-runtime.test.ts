import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	startStream: vi.fn(),
	releaseLock: vi.fn(async () => {}),
	releaseIfUnused: vi.fn(async () => {}),
	finalize: vi.fn(async () => {})
}));

vi.mock('ai', () => ({ consumeStream: vi.fn(), createAgentUIStreamResponse: mocks.startStream }));
vi.mock('$lib/agent/memory/service.server', () => ({
	addTutorMemoryExchange: vi.fn(),
	isTutorMemoryAvailable: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('$lib/agent/usage/controls.server', () => ({
	acquireCoachLock: async () => ({ key: 'lock', token: 'token' }),
	RedisRequiredError: class extends Error {},
	releaseLock: mocks.releaseLock,
	refreshLock: vi.fn()
}));
vi.mock('$lib/agent/agent.server', () => ({ createAgent: () => ({}) }));
vi.mock('$lib/agent/personalization/context.server', () => ({
	buildAgentContext: async () => ({ text: '', memoryDegraded: false })
}));
vi.mock('$lib/agent/access.server', () => ({
	getTutorProfileViewForRequest: async () => ({
		selectedApClasses: [],
		memoryDisclosureSeenAt: null
	})
}));
vi.mock('$lib/agent/usage/turn.server', () => ({
	startAgentTurn: async () => ({
		kind: 'available',
		usage: { remaining: 10_000 },
		chargeUsage: vi.fn(async () => {}),
		releaseIfUnused: mocks.releaseIfUnused
	})
}));
vi.mock('$lib/tutor/response-utils.server', () => ({ scheduleTutorMemoryWrite: vi.fn() }));
vi.mock('$lib/agent/conversations/history.server', () => ({
	buildAgentUiMessages: () => ({ messages: [], historySummary: '' }),
	reconstructApprovalContinuationMessage: vi.fn()
}));
vi.mock('$lib/agent/conversations/store.server', () => ({
	appendConversationMessage: async () => 'message-1',
	ensureConversation: async () => ({ id: 'conversation-1', userId: 'user-1', context: {} }),
	generateConversationTitle: async () => 'Title',
	ConversationAccessError: class extends Error {},
	finalizeConversationMessage: mocks.finalize,
	getConversationMessages: vi.fn(),
	getAgentHistory: async () => [],
	linkCoachAuditsToAssistantMessage: vi.fn(),
	markConversationMessageStreaming: vi.fn()
}));

import { createAgentStreamResponse } from '$lib/agent/stream.server';

afterEach(() => vi.useRealTimers());

describe('Coach stream startup', () => {
	it('cleans up timers, the lock, the message on async rejection', async () => {
		vi.useFakeTimers();
		const failure = new Error('SDK stream initialization failed');
		mocks.startStream.mockRejectedValueOnce(failure);

		await expect(
			createAgentStreamResponse({
				event: {
					request: new Request('https://app.test/api/super/agent'),
					locals: {},
					cookies: { get: () => undefined }
				},
				userId: 'user-1',
				sessionId: 'session-1',
				accessReason: 'subscription',
				context: { surface: 'coach', page: 'coach' },
				messages: [{ role: 'user', parts: [{ type: 'text', text: 'Help me study' }] }]
			} as unknown as Parameters<typeof createAgentStreamResponse>[0])
		).rejects.toBe(failure);

		expect(mocks.finalize).toHaveBeenCalledWith('user-1', 'message-1', {
			content: '',
			parts: [],
			status: 'error'
		});

		expect(mocks.releaseLock).toHaveBeenCalledWith({ key: 'lock', token: 'token' });
		expect(vi.getTimerCount()).toBe(0);
	});
});
