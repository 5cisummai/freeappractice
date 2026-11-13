import { describe, expect, it } from 'vitest';
import {
	hasShuffledMcqOptions,
	remapOptionLettersInText,
	shuffleLetters,
	shuffleMcqOptions
} from '#lib/question-bank/mcq/shuffle-options.js';

function sequenceRandom(values: number[]): () => number {
	let index = 0;
	return () => {
		const value = values[index] ?? 0;
		index += 1;
		return value;
	};
}

describe('shuffleMcqOptions', () => {
	const base = {
		optionA: 'alpha',
		optionB: 'bravo',
		optionC: 'charlie',
		optionD: 'delta',
		correctAnswer: 'A' as const,
		explanation: 'The correct answer is A because alpha. Option B is wrong.',
		choiceExplanations: {
			A: 'why alpha',
			B: 'why bravo',
			C: 'why charlie',
			D: 'why delta'
		},
		question: 'Pick one.',
		mainTopic: 'topic'
	};

	it('permutes options, correctAnswer, choiceExplanations, and explanation letters', () => {
		// Fisher–Yates with this stream yields sourceOrder [B, A, D, C]
		const shuffled = shuffleMcqOptions(base, sequenceRandom([0.625, 0.8333333333333334, 0.25]));

		expect(shuffled.optionA).toBe('bravo');
		expect(shuffled.optionB).toBe('alpha');
		expect(shuffled.optionC).toBe('delta');
		expect(shuffled.optionD).toBe('charlie');
		expect(shuffled.correctAnswer).toBe('B');
		expect(shuffled.choiceExplanations).toEqual({
			A: 'why bravo',
			B: 'why alpha',
			C: 'why delta',
			D: 'why charlie'
		});
		expect(shuffled.explanation).toBe('The correct answer is B because alpha. Option A is wrong.');
		expect(shuffled.optionsShuffled).toBe(true);
		expect(shuffled.question).toBe('Pick one.');
	});

	it('is a no-op permutation when the RNG always picks the current index', () => {
		const shuffled = shuffleMcqOptions(base, () => 0.999);
		expect(shuffled.optionA).toBe('alpha');
		expect(shuffled.optionB).toBe('bravo');
		expect(shuffled.optionC).toBe('charlie');
		expect(shuffled.optionD).toBe('delta');
		expect(shuffled.correctAnswer).toBe('A');
		expect(shuffled.optionsShuffled).toBe(true);
	});

	it('preserves null choiceExplanations', () => {
		const shuffled = shuffleMcqOptions(
			{ ...base, choiceExplanations: null },
			sequenceRandom([0.3, 0.1, 0])
		);
		expect(shuffled.choiceExplanations).toBeNull();
	});
});

describe('shuffleLetters', () => {
	it('returns a permutation of A–D', () => {
		const order = shuffleLetters(undefined, sequenceRandom([0.625, 0.8333333333333334, 0.25]));
		expect(order).toEqual(['B', 'A', 'D', 'C']);
		expect(new Set(order).size).toBe(4);
	});
});

describe('remapOptionLettersInText', () => {
	it('remaps letters without intermediate collisions', () => {
		expect(remapOptionLettersInText('A then B', { A: 'B', B: 'A', C: 'C', D: 'D' })).toBe(
			'B then A'
		);
	});
});

describe('hasShuffledMcqOptions', () => {
	it('detects the persisted flag', () => {
		expect(hasShuffledMcqOptions({ optionsShuffled: true })).toBe(true);
		expect(hasShuffledMcqOptions({ optionsShuffled: false })).toBe(false);
		expect(hasShuffledMcqOptions({})).toBe(false);
		expect(hasShuffledMcqOptions(null)).toBe(false);
	});
});
