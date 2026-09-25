import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	startStream: vi.fn(),
	releaseLock: vi.fn(async () => {}),
	releaseIfUnused: vi.fn(async () => {}),
	finalize: vi.fn(async () => {})
}));

vi.mock('ai', () => ({ consumeStream: vi.fn(), createAgentUIStreamResponse: mocks.startStream }));
vi.mock('$lib/mem0/service.server', () => ({
	addTutorMemoryExchange: vi.fn(),
	isTutorMemoryAvailable: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('$lib/super/ai-controls.server', () => ({
	acquireCoachLock: async () => ({ key: 'lock', token: 'token' }),
	getSuperMonthlyMessageLimit: vi.fn(),
	RedisRequiredError: class extends Error {},
	releaseLock: mocks.releaseLock,
	refreshLock: vi.fn()
}));
vi.mock('$lib/super/agent.server', () => ({ createSuperAgent: () => ({}) }));
vi.mock('$lib/super/context.server', () => ({
	buildSuperAgentContext: async () => ({ text: '', memoryDegraded: false })
}));
vi.mock('$lib/super/feature-access.server', () => ({
	getTutorProfileViewForRequest: async () => ({
		selectedApClasses: [],
		memoryDisclosureSeenAt: null
	})
}));
vi.mock('$lib/super/personalized-turn.server', () => ({
	startPersonalizedTurn: async () => ({
		kind: 'reserved',
		reservation: { remaining: 10 },
		releaseIfUnused: mocks.releaseIfUnused
	})
}));
vi.mock('$lib/tutor/response-utils.server', () => ({ scheduleTutorMemoryWrite: vi.fn() }));
vi.mock('$lib/super/agent-history.server', () => ({
	buildSuperAgentUiMessages: async () => ({ messages: [], historySummary: '' }),
	reconstructApprovalContinuationMessage: vi.fn()
}));
vi.mock('$lib/super/conversations.server', () => ({
	appendConversationMessage: async () => 'message-1',
	ensureConversation: async () => 'conversation-1',
	generateConversationTitle: async () => 'Title',
	ConversationAccessError: class extends Error {},
	finalizeConversationMessage: mocks.finalize,
	getConversationMessages: vi.fn(),
	linkCoachAuditsToAssistantMessage: vi.fn(),
	markConversationMessageStreaming: vi.fn()
}));

import { createSuperAgentStreamResponse } from '$lib/super/agent-runtime.server';

afterEach(() => vi.useRealTimers());

describe('Coach stream startup', () => {
	it('cleans up timers, the lock, the unused reservation, and the message on async rejection', async () => {
		vi.useFakeTimers();
		const failure = new Error('SDK stream initialization failed');
		mocks.startStream.mockRejectedValueOnce(failure);

		await expect(
			createSuperAgentStreamResponse({
				event: {
					request: new Request('https://app.test/api/super/agent'),
					locals: {},
					cookies: { get: () => undefined }
				},
				userId: 'user-1',
				sessionId: 'session-1',
				context: { surface: 'coach', page: 'coach' },
				messages: [{ role: 'user', parts: [{ type: 'text', text: 'Help me study' }] }]
			} as unknown as Parameters<typeof createSuperAgentStreamResponse>[0])
		).rejects.toBe(failure);

		expect(mocks.finalize).toHaveBeenCalledWith('user-1', 'message-1', {
			content: '',
			parts: [],
			status: 'error'
		});
		expect(mocks.releaseIfUnused).toHaveBeenCalledOnce();
		expect(mocks.releaseLock).toHaveBeenCalledWith({ key: 'lock', token: 'token' });
		expect(vi.getTimerCount()).toBe(0);
	});
});
