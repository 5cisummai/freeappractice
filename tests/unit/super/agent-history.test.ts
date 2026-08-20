import { describe, expect, it } from 'vitest';
import {
	isSuperAgentToolContinuation,
	minimalSuperAgentClientMessages
} from '$lib/super/agent-request';
import {
	shouldIncludeConversationRowForUi,
	toSuperAgentUiMessageFromConversationRow
} from '$lib/super/agent-ui-messages';
import { reconstructApprovalContinuationMessage } from '$lib/super/agent-history.server';

describe('minimalSuperAgentClientMessages', () => {
	it('sends only the latest user message for a normal turn', () => {
		const messages = [
			{ role: 'user' as const, parts: [{ type: 'text', text: 'First' }] },
			{ role: 'assistant' as const, parts: [{ type: 'text', text: 'Hi' }] },
			{ role: 'user' as const, parts: [{ type: 'text', text: 'Second' }] }
		];

		expect(minimalSuperAgentClientMessages(messages)).toEqual([messages[2]]);
	});

	it('sends only the assistant tool continuation message', () => {
		const messages = [
			{ role: 'user' as const, parts: [{ type: 'text', text: 'Quiz me' }] },
			{
				role: 'assistant' as const,
				parts: [
					{
						type: 'tool-give_practice_question',
						state: 'output-available',
						output: { status: 'answered' }
					}
				]
			}
		];

		expect(isSuperAgentToolContinuation(messages)).toBe(true);
		expect(minimalSuperAgentClientMessages(messages)).toEqual([messages[1]]);
	});

	it('sends only an approval response as a tool continuation', () => {
		const messages = [
			{ role: 'user' as const, parts: [{ type: 'text', text: 'Update my goals' }] },
			{
				role: 'assistant' as const,
				parts: [
					{
						type: 'tool-update_goals',
						state: 'approval-responded',
						approval: { id: 'approval-1', approved: true },
						input: { selectedApClasses: ['AP Biology'] }
					}
				]
			}
		];

		expect(isSuperAgentToolContinuation(messages)).toBe(true);
		expect(minimalSuperAgentClientMessages(messages)).toEqual([messages[1]]);
	});
});

describe('shouldIncludeConversationRowForUi', () => {
	it('excludes empty streaming placeholders on fresh turns', () => {
		expect(
			shouldIncludeConversationRowForUi(
				{
					id: 'assistant-1',
					role: 'assistant',
					content: '',
					parts: [],
					position: 1,
					status: 'streaming'
				},
				{ isContinuation: false, streamingAssistantMessageId: 'assistant-1' }
			)
		).toBe(false);
	});

	it('includes streaming assistant rows during tool continuations', () => {
		expect(
			shouldIncludeConversationRowForUi(
				{
					id: 'assistant-1',
					role: 'assistant',
					content: '',
					parts: [],
					position: 1,
					status: 'streaming'
				},
				{ isContinuation: true, streamingAssistantMessageId: 'assistant-1' }
			)
		).toBe(true);
	});

	it('excludes failed assistant rows with no content', () => {
		expect(
			shouldIncludeConversationRowForUi(
				{
					id: 'assistant-1',
					role: 'assistant',
					content: '',
					parts: [],
					position: 1,
					status: 'error'
				},
				{ isContinuation: false }
			)
		).toBe(false);
	});
});

describe('toSuperAgentUiMessageFromConversationRow', () => {
	it('builds a text part from stored content when parts are empty', () => {
		expect(
			toSuperAgentUiMessageFromConversationRow({
				id: 'user-1',
				role: 'user',
				content: 'Remember this',
				parts: [],
				position: 0,
				status: 'complete'
			})
		).toEqual({
			id: 'user-1',
			role: 'user',
			parts: [{ type: 'text', text: 'Remember this' }]
		});
	});

	it('returns null when there is no renderable content', () => {
		expect(
			toSuperAgentUiMessageFromConversationRow({
				id: 'assistant-1',
				role: 'assistant',
				content: '',
				parts: [],
				position: 1,
				status: 'error'
			})
		).toBeNull();
	});
});

describe('reconstructApprovalContinuationMessage', () => {
	const storedAssistant = {
		id: 'assistant-1',
		role: 'assistant' as const,
		content: '',
		parts: [
			{
				type: 'tool-update_goals',
				toolCallId: 'call-1',
				state: 'approval-requested',
				input: { selectedApClasses: ['AP Biology'] },
				approval: { id: 'approval-1', signature: 'server-signature' }
			}
		],
		position: 1,
		status: 'complete'
	};

	it('keeps stored input and approval metadata while applying the decision', () => {
		const result = reconstructApprovalContinuationMessage(storedAssistant, {
			role: 'assistant',
			parts: [
				{
					type: 'tool-update_goals',
					toolCallId: 'call-1',
					state: 'approval-responded',
					input: { selectedApClasses: ['AP Calculus BC'] },
					approval: { id: 'approval-1', approved: true, reason: 'client metadata' }
				}
			]
		});

		expect(result?.parts).toEqual([
			{
				type: 'tool-update_goals',
				toolCallId: 'call-1',
				state: 'approval-responded',
				input: { selectedApClasses: ['AP Biology'] },
				approval: { id: 'approval-1', approved: true, signature: 'server-signature' }
			}
		]);
	});

	it('rejects a response for a different stored approval', () => {
		expect(
			reconstructApprovalContinuationMessage(storedAssistant, {
				role: 'assistant',
				parts: [
					{
						type: 'tool-update_goals',
						toolCallId: 'call-1',
						state: 'approval-responded',
						input: { selectedApClasses: ['AP Calculus BC'] },
						approval: { id: 'approval-2', approved: true }
					}
				]
			})
		).toBeNull();
	});
});
