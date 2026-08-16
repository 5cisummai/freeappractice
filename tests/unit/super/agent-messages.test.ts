import { describe, expect, it } from 'vitest';
import { pruneSuperAgentModelMessages } from '$lib/super/agent-messages.server';
import type { ModelMessage } from 'ai';

describe('pruneSuperAgentModelMessages', () => {
	it('drops older tool results while keeping recent tool output', () => {
		const messages: ModelMessage[] = [
			{ role: 'user', content: 'Help me study' },
			{
				role: 'assistant',
				content: [
					{
						type: 'tool-call',
						toolCallId: 'old-call',
						toolName: 'read_insights',
						input: {}
					}
				]
			},
			{
				role: 'tool',
				content: [
					{
						type: 'tool-result',
						toolCallId: 'old-call',
						toolName: 'read_insights',
						output: { type: 'json', value: { units: ['Unit 1'] } }
					}
				]
			},
			{ role: 'assistant', content: 'Focus on Unit 1 first.' },
			{ role: 'user', content: 'Give me a question' },
			{
				role: 'assistant',
				content: [
					{
						type: 'tool-call',
						toolCallId: 'new-call',
						toolName: 'give_practice_question',
						input: { apClass: 'AP Physics 1' }
					}
				]
			},
			{
				role: 'tool',
				content: [
					{
						type: 'tool-result',
						toolCallId: 'new-call',
						toolName: 'give_practice_question',
						output: {
							type: 'json',
							value: { status: 'answered', selectedAnswer: 'B', isCorrect: false }
						}
					}
				]
			}
		];

		const pruned = pruneSuperAgentModelMessages(messages);
		const toolResults = pruned.flatMap((message) =>
			message.role === 'tool' ? message.content : []
		);

		expect(toolResults.some((part) => part.toolCallId === 'old-call')).toBe(false);
		expect(toolResults.some((part) => part.toolCallId === 'new-call')).toBe(true);
	});

	it('keeps give_practice_question results longer than bulky read tools', () => {
		const messages: ModelMessage[] = [
			{ role: 'user', content: 'Study' },
			{
				role: 'assistant',
				content: [
					{
						type: 'tool-call',
						toolCallId: 'insights-call',
						toolName: 'read_insights',
						input: {}
					}
				]
			},
			{
				role: 'tool',
				content: [
					{
						type: 'tool-result',
						toolCallId: 'insights-call',
						toolName: 'read_insights',
						output: { type: 'json', value: { topics: ['Unit 1'] } }
					}
				]
			},
			{ role: 'assistant', content: 'Focus on Unit 1.' },
			{ role: 'user', content: 'Question' },
			{
				role: 'assistant',
				content: [
					{
						type: 'tool-call',
						toolCallId: 'old-question',
						toolName: 'give_practice_question',
						input: { apClass: 'AP Physics 1' }
					}
				]
			},
			{
				role: 'tool',
				content: [
					{
						type: 'tool-result',
						toolCallId: 'old-question',
						toolName: 'give_practice_question',
						output: { type: 'json', value: { status: 'skipped' } }
					}
				]
			},
			{ role: 'assistant', content: 'Try this next.' },
			{ role: 'user', content: 'Another' },
			{
				role: 'assistant',
				content: [
					{
						type: 'tool-call',
						toolCallId: 'new-question',
						toolName: 'give_practice_question',
						input: { apClass: 'AP Physics 1' }
					}
				]
			},
			{
				role: 'tool',
				content: [
					{
						type: 'tool-result',
						toolCallId: 'new-question',
						toolName: 'give_practice_question',
						output: { type: 'json', value: { status: 'answered' } }
					}
				]
			}
		];

		const pruned = pruneSuperAgentModelMessages(messages);
		const toolResults = pruned.flatMap((message) =>
			message.role === 'tool' ? message.content : []
		);

		expect(toolResults.some((part) => part.toolCallId === 'insights-call')).toBe(false);
		expect(toolResults.some((part) => part.toolCallId === 'old-question')).toBe(true);
		expect(toolResults.some((part) => part.toolCallId === 'new-question')).toBe(true);
	});
});
