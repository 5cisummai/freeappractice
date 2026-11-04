import { describe, expect, it } from 'vitest';
import {
	assertMcqSubtopic,
	getMcqSubtopics,
	normalizeMcqEnrichment
} from '#lib/question-bank/mcq/enrichment.js';
import { parseMcqQuestionPayload } from '#lib/question-bank/mcq/payload-schema.js';
import { storedQuestionFromPayload } from '#lib/question-bank/mcq/repository.server.js';
import {
	storedQuestionToGenerated,
	generatedQuestionToMcqAnswerBody
} from '#lib/question-bank/mcq/public-payload.server.js';

import {
	apQuestionSchema,
	parseGeneratedApQuestion
} from '#lib/question-bank/mcq/generation.server.js';

const base = {
	course: 'AP Biology',
	unit: 'Unit 1: Chemistry of Life',
	question: 'Which statement is correct?',
	correctAnswer: 'A',
	optionA: 'A',
	optionB: 'B',
	optionC: 'C',
	optionD: 'D',
	explanation: 'Overall',
	mainTopic: 'Water',
	topicsCovered: 'Water',
	diagram: null
};
const enrichment = {
	difficulty: 'medium' as const,
	subtopicId: 'ap-biology-unit-1-topic-1',
	choiceExplanations: {
		A: 'Correct because...',
		B: 'Incorrect because...',
		C: 'Incorrect because...',
		D: 'Incorrect because...'
	}
};

describe('MCQ enrichment', () => {
	it('normalizes missing and partial legacy enrichment without losing the overall explanation', () => {
		expect(normalizeMcqEnrichment({})).toEqual({
			difficulty: null,
			subtopicId: null,
			choiceExplanations: null
		});
		expect(
			parseMcqQuestionPayload({ ...base, choiceExplanations: { A: 'Only one' } })
		).toMatchObject({ explanation: 'Overall', choiceExplanations: null });
	});
	it('preserves enrichment through stored, public, and client payloads', () => {
		const data = parseMcqQuestionPayload({ ...base, ...enrichment });
		const stored = storedQuestionFromPayload({ questionId: 'q1', data, createdAt: new Date() });
		const generated = storedQuestionToGenerated(stored);
		const body = generatedQuestionToMcqAnswerBody(generated);
		expect(stored).toMatchObject(enrichment);
		expect(generated).toMatchObject(enrichment);
		expect(body).toMatchObject(enrichment);
	});
	it('checks course/unit membership, not merely whether an ID exists', () => {
		expect(
			getMcqSubtopics(base.course, base.unit).some((t) => t.id === enrichment.subtopicId)
		).toBe(true);
		expect(() =>
			assertMcqSubtopic(base.course, 'Unit 2: Cell Structure and Function', enrichment.subtopicId)
		).toThrow();
	});
	it('requires enriched new output while accepting old submitted batch payloads', () => {
		expect(apQuestionSchema.safeParse(base).success).toBe(false);
		expect(apQuestionSchema.safeParse({ ...base, ...enrichment }).success).toBe(true);
		expect(parseGeneratedApQuestion(base)).toMatchObject({
			difficulty: null,
			subtopicId: null,
			choiceExplanations: null
		});
	});
});
