import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExamCore } from '../../../../src/lib/components/questions/exam-core.svelte';
import type { ExamSnapshot, GeneratedQuestion } from '../../../../src/lib/question-bank/mcq/types';

const questions: GeneratedQuestion[] = [
	{
		questionId: 'q-1',
		prompt: 'First?',
		options: [],
		correctAnswer: 'A',
		hasStimulus: false
	},
	{
		questionId: 'q-2',
		prompt: 'Second?',
		options: [],
		correctAnswer: 'B',
		hasStimulus: false
	}
];

afterEach(() => vi.useRealTimers());

describe('exam question timing', () => {
	it('records time spent on each question, including a revised answer', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-25T12:00:00Z'));
		let snapshot: ExamSnapshot | undefined;
		const exam = createExamCore({
			onComplete: (value) => {
				snapshot = value;
			}
		});
		await exam.start({ count: 2, questions });

		vi.advanceTimersByTime(1000);
		exam.setDraftCurrent('A');
		expect(exam.answers[0]?.timeTakenMs).toBe(1000);
		exam.next();

		vi.advanceTimersByTime(2500);
		exam.setDraftCurrent('B');
		exam.goTo(0);
		vi.advanceTimersByTime(500);
		exam.setDraftCurrent('C');
		await exam.submit();

		expect(snapshot?.items).toMatchObject([
			{ selectedAnswer: 'C', timeTakenMs: 1500, isCorrect: false },
			{ selectedAnswer: 'B', timeTakenMs: 2500, isCorrect: true }
		]);
		exam.destroy();
	});
});
