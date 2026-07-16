import { describe, expect, it } from 'vitest';
import {
	escapeHtml,
	formatTimeTaken,
	plainQuestionText,
	questionPreview
} from '$lib/history-display';
import type { HistoryItem } from '$lib/users/types';

describe('escapeHtml', () => {
	it('escapes HTML special characters', () => {
		expect(escapeHtml(`<a href="x">&`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
	});
});

describe('formatTimeTaken', () => {
	it('formats sanitized durations', () => {
		expect(formatTimeTaken(0)).toBeNull();
		expect(formatTimeTaken(45_000)).toBe('45s');
		expect(formatTimeTaken(60_000)).toBe('1m');
		expect(formatTimeTaken(90_000)).toBe('1m 30s');
	});
});

describe('plainQuestionText', () => {
	it('strips LaTeX and markdown noise', () => {
		expect(plainQuestionText('Hello $x^2$ and $$y$$ world')).toBe('Hello and world');
		expect(plainQuestionText('# Title **bold**')).toBe('Title bold');
	});
});

describe('questionPreview', () => {
	it('returns unavailable when question text is missing', () => {
		const item = { attempt: {} as HistoryItem['attempt'], question: null } as HistoryItem;
		expect(questionPreview(item)).toBe('Question unavailable');
	});

	it('truncates long plain text', () => {
		const item = {
			attempt: {} as HistoryItem['attempt'],
			question: {
				id: '1',
				question: 'a'.repeat(150),
				optionA: '',
				optionB: '',
				optionC: '',
				optionD: '',
				correctAnswer: 'A',
				explanation: '',
				createdAt: ''
			}
		} as HistoryItem;

		const preview = questionPreview(item, 20);
		expect(preview).toBe(`${'a'.repeat(20)}…`);
	});
});
