import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	openTurn: vi.fn(async () => 'test-eve-turn'),
	streamEveTurn: vi.fn(),
	closeEveTurn: vi.fn(async () => {}),
	releaseLock: vi.fn(async () => {}),
	releaseIfUnused: vi.fn(async () => {}),
	finalize: vi.fn(async () => {})
}));

vi.mock('#lib/agent/eve-turn.server.js', () => ({
	openEveTurn: mocks.openTurn,
	closeEveTurn: mocks.closeEveTurn,
	getEveSearchCount: async () => 0
}));
vi.mock('#lib/agent/eve-stream.server.js', () => ({ streamEveTurn: mocks.streamEveTurn }));
vi.mock('#lib/agent/eve-tools.server.js', () => ({ eveToolNames: ['read_profile'] }));
vi.mock('#lib/agent/memory/service.server.js', () => ({
	addTutorMemoryExchange: vi.fn(),
	isTutorMemoryAvailable: vi.fn()
}));
vi.mock('#lib/server/logger.js', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('#lib/agent/usage/controls.server.js', () => ({
	acquireCoachLock: async () => ({ key: 'lock', token: 'token' }),
	RedisRequiredError: class extends Error {},
	releaseLock: mocks.releaseLock,
	refreshLock: vi.fn()
}));
vi.mock('#lib/agent/personalization/context.server.js', () => ({
	buildAgentContext: async () => ({ text: '', memoryDegraded: false })
}));
vi.mock('#lib/agent/access.server.js', () => ({
	getTutorProfileViewForRequest: async () => ({
		selectedApClasses: [],
		memoryDisclosureSeenAt: null
	})
}));
vi.mock('#lib/agent/attachments/images.server.js', () => ({
	prepareCoachImageParts: vi.fn(async () => ({ savedParts: [], upload: undefined })),
	linkCoachImage: vi.fn(),
	coachImageModelMessages: vi.fn((messages) => messages),
	coachImageManifest: vi.fn(async () => '')
}));
vi.mock('#lib/agent/usage/turn.server.js', () => ({
	startAgentTurn: async () => ({
		kind: 'available',
		usage: { remaining: 10_000 },
		chargeUsage: vi.fn(async () => {}),
		releaseIfUnused: mocks.releaseIfUnused
	})
}));
vi.mock('#lib/tutor/response-utils.server.js', () => ({ scheduleTutorMemoryWrite: vi.fn() }));
vi.mock('#lib/agent/conversations/history.server.js', () => ({
	buildAgentUiMessages: () => ({ messages: [], historySummary: '' }),
	reconstructApprovalContinuationMessage: vi.fn()
}));
vi.mock('#lib/agent/conversations/store.server.js', () => ({
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

import { createAgentStreamResponse } from '#lib/agent/stream.server.js';

afterEach(() => vi.useRealTimers());

function runTurn(request = new Request('https://app.test/api/coach')) {
	return createAgentStreamResponse({
		event: { request, locals: {}, cookies: { get: () => undefined } },
		userId: 'user-1',
		sessionId: 'session-1',
		accessReason: 'subscription',
		context: { surface: 'coach', page: 'coach' },
		messages: [{ role: 'user', parts: [{ type: 'text', text: 'Help me study' }] }]
	} as unknown as Parameters<typeof createAgentStreamResponse>[0]);
}

describe('Coach stream startup', () => {
	it('cleans up timers, the lock, the message on async rejection', async () => {
		vi.useFakeTimers();
		const failure = new Error('SDK stream initialization failed');
		mocks.openTurn.mockRejectedValueOnce(failure);

		await expect(runTurn()).rejects.toBe(failure);

		expect(mocks.finalize).toHaveBeenCalledWith('user-1', 'message-1', {
			content: '',
			parts: [],
			status: 'error'
		});

		expect(mocks.releaseLock).toHaveBeenCalledWith({ key: 'lock', token: 'token' });
		expect(vi.getTimerCount()).toBe(0);
	});

	it('persists a reaction-only response and closes the Eve credential', async () => {
		const reaction = {
			type: 'data-coach-reaction',
			id: 'call-1',
			data: { targetId: 'user-message', emoji: '🎉' }
		};
		mocks.streamEveTurn.mockImplementationOnce(async ({ writer }) => writer.write(reaction));
		const response = await runTurn();
		expect(await response.text()).toContain('data-coach-reaction');
		expect(mocks.finalize).toHaveBeenLastCalledWith('user-1', 'message-1', {
			content: '',
			parts: [{ type: 'step-start' }, reaction],
			status: 'complete',
			clientMessageId: 'message-1'
		});
		expect(mocks.closeEveTurn).toHaveBeenCalledWith('test-eve-turn');
	});

	it('releases the lock and revokes the tool credential when the upstream fails', async () => {
		mocks.streamEveTurn.mockRejectedValueOnce(new Error('upstream error'));
		const response = await runTurn();
		expect(await response.text()).toContain('Please try again');
		expect(mocks.finalize).toHaveBeenLastCalledWith('user-1', 'message-1', {
			content: '',
			parts: [],
			status: 'error',
			clientMessageId: 'message-1'
		});
		expect(mocks.closeEveTurn).toHaveBeenCalledWith('test-eve-turn');
	});
	it('aborts the Eve request and releases the lock when the browser cancels the stream', async () => {
		const listener = vi.fn();
		mocks.streamEveTurn.mockImplementationOnce(
			({ signal }) =>
				new Promise((_, reject) => {
					signal.addEventListener(
						'abort',
						() => {
							listener();
							reject(signal.reason);
						},
						{ once: true }
					);
				})
		);
		const response = await runTurn();
		await response.body?.cancel();
		await vi.waitFor(() =>
			expect(mocks.finalize).toHaveBeenLastCalledWith(
				'user-1',
				'message-1',
				expect.objectContaining({ status: 'aborted' })
			)
		);
		expect(listener).toHaveBeenCalledOnce();
		expect(mocks.releaseLock).toHaveBeenCalled();
	});
});
