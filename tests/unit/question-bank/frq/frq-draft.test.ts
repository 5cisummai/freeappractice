import { describe, expect, it } from 'vitest';
import {
	FRQ_DRAFT_MAX_AGE_MS,
	FRQ_DRAFT_VERSION,
	parseFrqLatestDraft,
	parseFrqQuestionDraft,
	serializeFrqLatestDraft,
	serializeFrqQuestionDraft
} from '$lib/question-bank/frq/draft.client';
import type { PublicFrqQuestion } from '$lib/question-bank/frq/types';

const now = Date.parse('2026-08-09T12:00:00.000Z');
const question: PublicFrqQuestion = {
	questionId: 'frq-1',
	schemaVersion: 2,
	formatId: 'short-conceptual-analysis',
	responseMode: 'parts',
	prompt: 'Explain the result.',
	materials: [],
	parts: [
		{
			id: 'A',
			label: 'A',
			prompt: 'Explain.',
			points: 1
		}
	],
	mainTopic: 'Cells',
	topicsCovered: 'Cells',
	course: 'AP Biology',
	unit: 'Unit 1'
};

describe('FRQ session drafts', () => {
	it('round-trips versioned question and latest drafts', () => {
		const responses = { A: 'Evidence and reasoning.' };
		const questionDraft = serializeFrqQuestionDraft(question, responses, now);
		const latestDraft = serializeFrqLatestDraft(question, responses, now);

		expect(parseFrqQuestionDraft(questionDraft, question, now)).toEqual(responses);
		expect(parseFrqLatestDraft(latestDraft, { course: 'AP Biology', unit: 'Unit 1' }, now)).toEqual(
			{ question, responses }
		);
	});

	it('rejects malformed, stale, and wrong-version question drafts', () => {
		const valid = JSON.parse(serializeFrqQuestionDraft(question, { A: 'response' }, now));

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
		const raw = serializeFrqLatestDraft(question, { A: 'response' }, now);

		expect(parseFrqLatestDraft(raw, { course: 'AP Chemistry', unit: 'Unit 1' }, now)).toBeNull();
		expect(
			parseFrqLatestDraft(
				JSON.stringify({ version: FRQ_DRAFT_VERSION, savedAt: now, question: { prompt: 'x' } }),
				{ course: 'AP Biology' },
				now
			)
		).toBeNull();
	});

	it('keeps one essay draft key', () => {
		const essay: PublicFrqQuestion = {
			...question,
			formatId: 'argument',
			responseMode: 'essay',
			parts: [
				{ id: 'thesis', label: 'Thesis', prompt: 'State a thesis.', points: 1 },
				{
					id: 'evidence-commentary',
					label: 'Evidence and Commentary',
					prompt: 'Support it.',
					points: 4
				},
				{ id: 'sophistication', label: 'Sophistication', prompt: 'Deepen it.', points: 1 }
			]
		};
		const responses = { essay: 'One continuous essay.' };
		expect(
			parseFrqQuestionDraft(serializeFrqQuestionDraft(essay, responses, now), essay, now)
		).toEqual(responses);
	});
});
