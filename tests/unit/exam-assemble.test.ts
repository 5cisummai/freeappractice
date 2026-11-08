import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class QuizPoolWarmingError extends Error {
		readonly code = 'POOL_WARMING';
		readonly availableCount: number;
		constructor(message = 'warming', availableCount = 0) {
			super(message);
			this.name = 'QuizPoolWarmingError';
			this.availableCount = availableCount;
		}
	}
	return {
		assembleMcqQuiz: vi.fn(),
		requestQuizRefill: vi.fn(),
		frqGet: vi.fn(),
		isStimulusQuestionsEnabled: vi.fn(),
		QuizPoolWarmingError,
		mcqRows: [] as { questionId: string }[],
		frqRows: [] as { questionId: string }[],
		examRows: [] as { sections: { items: { questionId: string }[] }[] }[]
	};
});

vi.mock('#lib/flags.js', () => ({
	isStimulusQuestionsEnabled: mocks.isStimulusQuestionsEnabled
}));

vi.mock('#lib/question-bank/mcq/quiz-assembler.server.js', () => ({
	assembleMcqQuiz: mocks.assembleMcqQuiz,
	requestQuizRefill: mocks.requestQuizRefill,
	QuizPoolWarmingError: mocks.QuizPoolWarmingError
}));

vi.mock('#lib/question-bank/frq/bank.server.js', () => ({
	frqBank: { get: mocks.frqGet }
}));

vi.mock('#lib/server/logger.js', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({
		select: (cols: Record<string, unknown>) => ({
			from: () => ({
				where: () => ({
					orderBy: () => ({
						limit: async () => {
							if ('sections' in cols) return mocks.examRows;
							return mocks.mcqRows.length ? mocks.mcqRows : mocks.frqRows;
						}
					})
				})
			})
		})
	})
}));

vi.mock('#lib/server/neon/schema.js', () => ({
	mcqAttempts: { userId: {}, course: {}, questionId: {}, createdAt: {}, id: {} },
	frqAttempts: { userId: {}, course: {}, questionId: {}, createdAt: {}, id: {} },
	examAttempts: { userId: {}, course: {}, sections: {}, startedAt: {}, id: {} }
}));

vi.mock('drizzle-orm', () => ({
	and: (...args: unknown[]) => args,
	eq: (...args: unknown[]) => args,
	desc: (...args: unknown[]) => args
}));

import { assembleExamSections } from '#lib/exams/assemble.server.js';

function mcqQuestions(count: number) {
	return Array.from({ length: count }, (_, index) => ({
		questionId: `mcq-${index + 1}`,
		question: `Q${index + 1}`,
		options: { A: 'a', B: 'b', C: 'c', D: 'd' },
		correctAnswer: 'A'
	}));
}

describe('assembleExamSections', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mcqRows = [];
		mocks.frqRows = [];
		mocks.examRows = [];
		mocks.isStimulusQuestionsEnabled.mockResolvedValue(false);
		mocks.requestQuizRefill.mockResolvedValue(true);
		mocks.assembleMcqQuiz.mockResolvedValue({
			questions: mcqQuestions(60),
			metrics: {}
		});
		let frqIndex = 0;
		mocks.frqGet.mockImplementation(async () => {
			frqIndex += 1;
			return {
				status: 'found',
				exclusionsReset: false,
				result: { questionId: `frq-${frqIndex}` }
			};
		});
	});

	it('assembles AP Biology with 60 unique MCQ and 6 unique FRQ items', async () => {
		const result = await assembleExamSections({ userId: 'user', courseName: 'AP Biology' });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sections).toHaveLength(2);
		const [mcq, frq] = result.sections;
		expect(mcq.kind).toBe('mcq');
		expect(mcq.items).toHaveLength(60);
		expect(frq.kind).toBe('frq');
		expect(frq.items).toHaveLength(6);
		const ids = result.sections.flatMap((section) => section.items.map((item) => item.questionId));
		expect(new Set(ids).size).toBe(66);
		expect(mocks.assembleMcqQuiz).toHaveBeenCalledWith(
			expect.objectContaining({ course: 'AP Biology', count: 60, maxCount: 60 }),
			expect.any(Object)
		);
	});

	it('returns unsupported for unknown courses', async () => {
		const result = await assembleExamSections({ userId: 'user', courseName: 'Not Real' });
		expect(result).toMatchObject({ ok: false, code: 'unsupported' });
	});

	it('returns unsupported when FRQ practice is disabled', async () => {
		const result = await assembleExamSections({ userId: 'user', courseName: 'AP Calculus AB' });
		expect(result).toMatchObject({
			ok: false,
			code: 'unsupported',
			reason: 'FRQ practice is not enabled for AP Calculus AB.'
		});
	});

	it('returns warming when the MCQ pool cannot fill the blueprint', async () => {
		mocks.assembleMcqQuiz.mockRejectedValue(new mocks.QuizPoolWarmingError('warming', 12));
		const result = await assembleExamSections({ userId: 'user', courseName: 'AP Biology' });
		expect(result).toMatchObject({ ok: false, code: 'warming' });
		expect(mocks.requestQuizRefill).toHaveBeenCalled();
	});

	it('returns warming when FRQ draws exhaust unique inventory', async () => {
		mocks.frqGet.mockResolvedValue({
			status: 'found',
			exclusionsReset: true,
			result: { questionId: 'frq-reuse' }
		});
		const result = await assembleExamSections({ userId: 'user', courseName: 'AP Biology' });
		expect(result).toMatchObject({ ok: false, code: 'warming' });
	});

	it('avoids recent exam question IDs when assembling', async () => {
		mocks.examRows = [
			{
				sections: [
					{
						items: [{ questionId: 'seen-exam-1' }, { questionId: 'seen-exam-2' }]
					}
				]
			}
		];
		await assembleExamSections({ userId: 'user', courseName: 'AP Biology' });
		expect(mocks.assembleMcqQuiz).toHaveBeenCalledWith(
			expect.objectContaining({
				excludeQuestionIds: expect.arrayContaining(['seen-exam-1', 'seen-exam-2'])
			}),
			expect.any(Object)
		);
	});
});
