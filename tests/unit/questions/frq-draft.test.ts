import { describe, expect, it } from 'vitest';
import {
	FRQ_DRAFT_MAX_AGE_MS,
	FRQ_DRAFT_VERSION,
	parseFrqLatestDraft,
	parseFrqQuestionDraft,
	serializeFrqLatestDraft,
	serializeFrqQuestionDraft
} from '$lib/questions/frq-draft.client';
import type { PublicFrqQuestion } from '$lib/frq/types';

const now = Date.parse('2026-08-09T12:00:00.000Z');
const question: PublicFrqQuestion = {
	questionId: 'frq-1',
	schemaVersion: 1,
	formatId: 'short-answer',
	profileVersion: 'biology-v1',
	promptVersion: 'prompt-v1',
	rubricVersion: 'rubric-v1',
	prompt: 'Explain the result.',
	materials: [],
	sections: [
		{
			id: 'a',
			label: 'A',
			prompt: 'Explain.',
			responseKind: 'text',
			maxPoints: 1
		}
	],
	totalPoints: 1,
	topicsCovered: 'Cells',
	apClass: 'AP Biology',
	unit: 'Unit 1'
};

describe('FRQ session drafts', () => {
	it('round-trips versioned question and latest drafts', () => {
		const responses = { a: 'Evidence and reasoning.' };
		const questionDraft = serializeFrqQuestionDraft(question, responses, now);
		const latestDraft = serializeFrqLatestDraft(question, responses, now);

		expect(parseFrqQuestionDraft(questionDraft, question, now)).toEqual(responses);
		expect(
			parseFrqLatestDraft(latestDraft, { apClass: 'AP Biology', unit: 'Unit 1' }, now)
		).toEqual({ question, responses });
	});

	it('rejects malformed, stale, and wrong-version question drafts', () => {
		const valid = JSON.parse(serializeFrqQuestionDraft(question, { a: 'response' }, now));

		expect(parseFrqQuestionDraft('{not-json', question, now)).toBeNull();
		expect(
			parseFrqQuestionDraft(
				JSON.stringify({ ...valid, version: FRQ_DRAFT_VERSION + 1 }),
				question,
				now
			)
		).toBeNull();
		expect(
			parseFrqQuestionDraft(
				JSON.stringify({ ...valid, savedAt: now - FRQ_DRAFT_MAX_AGE_MS - 1 }),
				question,
				now
			)
		).toBeNull();
		expect(
			parseFrqQuestionDraft(
				JSON.stringify({ ...valid, responses: { unknown: 'response' } }),
				question,
				now
			)
		).toBeNull();
	});

	it('rejects latest drafts for another course or invalid question data', () => {
		const raw = serializeFrqLatestDraft(question, { a: 'response' }, now);

		expect(parseFrqLatestDraft(raw, { apClass: 'AP Chemistry', unit: 'Unit 1' }, now)).toBeNull();
		expect(parseFrqLatestDraft(raw, { apClass: 'AP Biology' }, now)).toEqual({
			question,
			responses: { a: 'response' }
		});
		expect(
			parseFrqLatestDraft(
				JSON.stringify({ ...JSON.parse(raw), question: { ...question, rubric: [] } }),
				{ apClass: 'AP Biology', unit: 'Unit 1' },
				now
			)
		).toBeNull();
	});
});
