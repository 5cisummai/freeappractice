import { beforeEach, describe, expect, it, vi } from 'vitest';

const { aiCallMock, generateMock, infoMock, stimulusFlagMock, ToolLoopAgentMock } = vi.hoisted(
	() => {
		const aiCallMock = vi.fn(() => () => {});
		const generateMock = vi.fn();
		const infoMock = vi.fn();
		const stimulusFlagMock = vi.fn(async () => true);
		const ToolLoopAgentMock = vi.fn(function (_settings: unknown) {
			return { generate: generateMock };
		});
		return { aiCallMock, generateMock, infoMock, stimulusFlagMock, ToolLoopAgentMock };
	}
);

vi.mock('$env/static/private', () => ({
	OPEN_AI_KEY: 'test-key'
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		OPENAI_BASE_URL: 'https://api.openai.com/v1'
	}
}));

vi.mock('$lib/flags', () => ({
	isStimulusQuestionsEnabled: stimulusFlagMock
}));

vi.mock('ai', async (importOriginal) => {
	const actual = await importOriginal<typeof import('ai')>();
	return {
		...actual,
		ToolLoopAgent: ToolLoopAgentMock
	};
});

vi.mock('$lib/server/logger', () => ({
	logger: {
		aiCall: aiCallMock,
		error: vi.fn(),
		info: infoMock,
		warn: vi.fn()
	}
}));

import {
	generateAPQuestion,
	generateAPStimulusSet
} from '$lib/question-bank/mcq/generation.server';

const validGeneratedQuestion = {
	question: 'Which agricultural practice is most associated with intensive subsistence farming?',
	optionA: 'Nomadic herding across arid steppes',
	optionB: 'Wet-rice cultivation on small plots',
	optionC: 'Ranching on extensive grasslands',
	optionD: 'Plantation monoculture for export',
	correctAnswer: 'B' as const,
	explanation: 'Intensive subsistence farming often centers on wet-rice cultivation.',
	mainTopic: 'Intensive subsistence agriculture',
	topicsCovered: 'Intensive subsistence agriculture and wet-rice farming patterns',
	diagram: null
};

describe('MCQ live generation pipeline', () => {
	beforeEach(() => {
		aiCallMock.mockClear();
		generateMock.mockReset();
		infoMock.mockClear();
		stimulusFlagMock.mockResolvedValue(true);
		ToolLoopAgentMock.mockClear();
	});

	it('runs generateAPQuestion end-to-end without S3 persistence', async () => {
		generateMock.mockResolvedValue({
			output: validGeneratedQuestion,
			usage: { inputTokens: 10, outputTokens: 20 }
		});

		const result = await generateAPQuestion({
			className: 'AP Human Geography',
			unit: 'Unit 5: Agriculture and Rural Land-Use Patterns and Processes'
		});

		expect(generateMock).toHaveBeenCalledTimes(1);
		expect(result.questionId).toEqual(expect.any(String));
		expect(result.answer.mainTopic).toBe(validGeneratedQuestion.mainTopic);
		expect(result.provider).toBe('ai');
		expect(result.model).toBe('gpt-5.6-luna');
		expect(result.timing?.generationMs).toBeGreaterThanOrEqual(0);
		expect(result.timing?.persistenceMs).toBeGreaterThanOrEqual(0);
	});

	it('returns a generated id without persisting the question', async () => {
		generateMock.mockResolvedValue({
			output: validGeneratedQuestion,
			usage: { inputTokens: 1, outputTokens: 1 }
		});

		const result = await generateAPQuestion({
			className: 'AP Biology',
			unit: 'Unit 1'
		});

		expect(result).toMatchObject({ answer: validGeneratedQuestion });
		expect(result.questionId).toEqual(expect.any(String));
		expect(result.timing?.persistenceMs).toBe(0);
	});

	it('generates diagram stimulus sets with supporting text and Examfig validation', async () => {
		const child = {
			question: 'Which condition has the greater measured rate?',
			optionA: 'Condition A',
			optionB: 'Condition B',
			optionC: 'They are equal',
			optionD: 'The rate cannot be determined',
			correctAnswer: 'B' as const,
			explanation: 'Condition B has the larger value in the table.',
			mainTopic: 'Reaction rates',
			topicsCovered: 'Comparing reaction rates from tabular evidence'
		};
		generateMock.mockResolvedValue({
			output: {
				stimulus: {
					text: 'The table compares measured rates for two conditions.',
					diagram: JSON.stringify({
						type: 'table',
						accessibleDescription: 'A table comparing reaction rates for two conditions.',
						headers: ['Condition', 'Rate'],
						rows: [
							['A', '1'],
							['B', '2']
						]
					})
				},
				questions: [child, child, child]
			},
			usage: { inputTokens: 10, outputTokens: 20 }
		});

		await generateAPStimulusSet({
			className: 'AP Chemistry',
			unit: 'Unit 1: Atomic Structure and Properties',
			childCount: 3,
			mode: 'diagram'
		});

		const settings = ToolLoopAgentMock.mock.calls[0]?.[0] as
			{ tools?: unknown; onStepFinish?: (event: unknown) => void } | undefined;
		expect(settings?.tools).toEqual(
			expect.objectContaining({ validateExamfigDiagram: expect.anything() })
		);
		expect(aiCallMock).toHaveBeenCalledWith(
			'generateAPStimulusSet',
			'gpt-5.6-luna',
			expect.objectContaining({ mode: 'diagram' })
		);
	});

	it('rejects a stimulus when Examfig cannot render its diagram', async () => {
		const child = {
			question: 'Which region is represented?',
			optionA: 'Region A',
			optionB: 'Region B',
			optionC: 'Region C',
			optionD: 'Region D',
			correctAnswer: 'A' as const,
			explanation: 'The diagram identifies Region A.',
			mainTopic: 'Maps',
			topicsCovered: 'Map interpretation'
		};
		generateMock.mockResolvedValue({
			output: {
				stimulus: {
					text: null,
					diagram: JSON.stringify({
						type: 'map',
						accessibleDescription: 'A map with no region definitions.'
					})
				},
				questions: [child, child, child]
			},
			usage: { inputTokens: 10, outputTokens: 20 }
		});

		await expect(
			generateAPStimulusSet({
				className: 'AP Human Geography',
				unit: 'Unit 1: Thinking Geographically',
				childCount: 3,
				mode: 'diagram'
			})
		).rejects.toThrow('Generated stimulus diagram failed validation');
	});
});
