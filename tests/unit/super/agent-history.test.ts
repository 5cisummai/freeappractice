import { describe, expect, it } from 'vitest';
import {
	isSuperAgentToolContinuation,
	minimalSuperAgentClientMessages
} from '$lib/super/agent-request';

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
});
