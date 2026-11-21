import { afterEach, describe, expect, it } from 'vitest';
import { createExamCore } from '#lib/components/questions/exam-core.svelte.js';
import type { GeneratedQuestion } from '#lib/question-bank/mcq/types.js';

function mcq(id: string): GeneratedQuestion {
	return {
		questionId: id,
		prompt: `Question ${id}`,
		options: [
			{ id: 'A', label: 'A', text: 'Choice A' },
			{ id: 'B', label: 'B', text: 'Choice B' }
		],
		correctAnswer: 'A',
		hasStimulus: false
	};
}

describe('createExamCore quiz start', () => {
	const cores: Array<ReturnType<typeof createExamCore>> = [];

	afterEach(() => {
		for (const exam of cores) exam.destroy();
		cores.length = 0;
	});

	it('starts with the questions the loader actually returned', async () => {
		const exam = createExamCore({
			getMounted: () => true,
			loadQuestions: async () => [mcq('a'), mcq('b')]
		});
		cores.push(exam);

		await exam.start({ count: 10, meta: { kind: 'quiz' } });

		expect(exam.status).toBe('active');
		expect(exam.requestedCount).toBe(2);
		expect(exam.loadedCount).toBe(2);
		expect(exam.errorMessage).toBe('');
	});

	it('errors when the loader returns no questions', async () => {
		const exam = createExamCore({
			getMounted: () => true,
			loadQuestions: async () => []
		});
		cores.push(exam);

		await exam.start({ count: 10, meta: { kind: 'quiz' } });

		expect(exam.status).toBe('error');
		expect(exam.errorMessage).toBe('Quiz service returned no questions.');
	});
});
